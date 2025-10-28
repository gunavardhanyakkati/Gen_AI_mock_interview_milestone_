import os
import json
import tempfile
import subprocess
from pathlib import Path
from typing import Optional, Tuple, Dict, Any, List

# Core ML Libraries
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchaudio
import numpy as np
import cv2
import whisper # Ensure you have 'pip install openai-whisper'

# FastAPI Libraries
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from tqdm import tqdm # Import tqdm for descriptive loop running

# --- Configuration Constants ---
# IMPORTANT: Set this to 'cpu' if you plan to deploy without a GPU,
# as Whisper and PyTorch models can consume a lot of memory.
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
TARGET_SR = 16000 # Must match the MelSpectrogram and FFmpeg extraction rate

# --- Global Artifact Paths ---
# Adjust these paths relative to where you run app.py
# NOTE: The drive path from your script is NOT suitable for deployment.
# Place these files in the SAME directory as app.py
MODEL_PATH = Path("best_model.pt") # Assuming you copied the model here
VOCAB_PATH = Path("vocabulary.json") # Assuming you copied the vocab here

# Global variables for the app
model: Optional[nn.Module] = None
idx_to_word: Optional[Dict[int, str]] = None
whisper_model: Optional[Any] = None

app = FastAPI(
    title="A/V Sentence Classifier API",
    description="Predicts words using an A/V model segmented by Whisper."
)

# --- CORS Configuration (Essential for frontend access) ---
origins = [
    "http://localhost",
    "http://localhost:5173", # Add your frontend's host/port
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# === 1. MODEL ARCHITECTURE DEFINITION ===
# ==============================================================================

class VisualFrontend(nn.Module):
    def __init__(self, hidden_dim=512):
        super().__init__()
        self.conv1 = nn.Conv3d(1, 64, kernel_size=(5, 7, 7), stride=(1, 2, 2), padding=(2, 3, 3), bias=False)
        self.bn1 = nn.BatchNorm3d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool3d(kernel_size=(1, 3, 3), stride=(1, 2, 2), padding=(0, 1, 1))
        self.layer1 = self._make_layer(64, 64, 2, stride=1)
        self.layer2 = self._make_layer(64, 128, 2, stride=2)
        self.layer3 = self._make_layer(128, 256, 2, stride=2)
        self.layer4 = self._make_layer(256, 512, 2, stride=2)
        self.avgpool = nn.AdaptiveAvgPool3d((None, 1, 1))
        self.projection = nn.Linear(512, hidden_dim)

    def _make_layer(self, inplanes, planes, blocks, stride=1):
        layers = [nn.Conv3d(inplanes, planes, 3, (1, stride, stride), 1, bias=False), nn.BatchNorm3d(planes), nn.ReLU(inplace=True)]
        for _ in range(blocks - 1):
            layers.extend([nn.Conv3d(planes, planes, 3, 1, 1, bias=False), nn.BatchNorm3d(planes), nn.ReLU(inplace=True)])
        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.relu(self.bn1(self.conv1(x)))
        x = self.maxpool(x)
        x = self.layer1(x); x = self.layer2(x)
        x = self.layer3(x); x = self.layer4(x)
        x = self.avgpool(x)
        x = x.flatten(2).transpose(1, 2)
        return self.projection(x)

class AudioFrontend(nn.Module):
    def __init__(self, hidden_dim=512):
        super().__init__()
        self.conv_stack = nn.Sequential(
            nn.Conv2d(1, 64, 3, 1, 1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, 1, 1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(128, 256, 3, 1, 1), nn.ReLU(), nn.MaxPool2d(2)
        )
        self.adaptive_pool = nn.AdaptiveAvgPool2d((1, 1))
        self.projection = nn.Linear(256, hidden_dim)

    def forward(self, x):
        if x.dim() == 5:
            x = x.squeeze(1)
        x = self.conv_stack(x)
        x = self.adaptive_pool(x)
        x = x.flatten(1)
        return self.projection(x)

class AVWordClassifier(nn.Module):
    def __init__(self, num_classes, hidden_dim=512, rnn_layers=2):
        super().__init__()
        self.visual_frontend = VisualFrontend(hidden_dim=hidden_dim)
        self.audio_frontend = AudioFrontend(hidden_dim=hidden_dim)
        self.video_rnn = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=rnn_layers,
            batch_first=True
        )
        self.classifier_head = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(hidden_dim, num_classes)
        )

    def forward(self, video, audio):
        video_feat_seq = self.visual_frontend(video)
        # video_feat_seq shape: (B, T, D)
        _, (video_rnn_hidden, _) = self.video_rnn(video_feat_seq)
        # video_rnn_hidden shape: (num_layers, B, D)
        video_representation = video_rnn_hidden[-1] # Take hidden state of last layer (B, D)
        audio_feat = self.audio_frontend(audio)
        fused_feat = torch.cat((video_representation, audio_feat), dim=1)
        return self.classifier_head(fused_feat)


# ==============================================================================
# === 2. INFERENCE HELPERS ===
# ==============================================================================

# MelSpectrogram transform must be defined globally after startup
mel_transform = None

def run_inference_on_word(word_video_frames: List[np.ndarray], word_audio_waveform: torch.Tensor) -> Optional[str]:
    """
    Preprocesses a single word segment and returns the model's predicted word.
    """
    # Check if frame list is empty. If so, don't try to process.
    if not word_video_frames or mel_transform is None:
        print("Skipping word: No video frames found.")
        return None
        
    try:
        # --- 1. Process Video ---
        # (T, H, W) -> (C, T, H, W) -> (B, C, T, H, W)
        video_tensor = torch.from_numpy(
            np.array(word_video_frames, dtype=np.float32) / 255.0
        ).unsqueeze(0) # Add Channel dim (C=1)
        
        video_batch = video_tensor.unsqueeze(0).to(DEVICE) # Add Batch dim (B=1)

        # --- 2. Process Audio ---
        # Ensure audio is mono (C=1)
        if word_audio_waveform.shape[0] > 1:
            word_audio_waveform = torch.mean(word_audio_waveform, dim=0, keepdim=True)
        
        # Pad audio slightly if it's too short for a single Mel frame (n_fft=400)
        if word_audio_waveform.shape[1] < 400:
            word_audio_waveform = F.pad(word_audio_waveform, (0, 400 - word_audio_waveform.shape[1]))

        # ======================================================================
        # === FIX 1: Move audio tensor to the correct device ===
        # ======================================================================
        word_audio_waveform = word_audio_waveform.to(DEVICE)

        mel_spec = mel_transform(word_audio_waveform)
        
        # (C, F, T_mel) -> (1, C, F, T_mel) -> (B, 1, C, F, T_mel)
        mel_spec_unsqueezed = mel_spec.unsqueeze(0) 
        audio_batch = mel_spec_unsqueezed.unsqueeze(0).to(DEVICE)

        # --- 3. Run Model ---
        with torch.no_grad():
            logits = model(video_batch, audio_batch)
        
        pred_idx = torch.argmax(logits, dim=1).item()
        pred_word = idx_to_word.get(pred_idx, "[UNK]")
        
        return pred_word
    except Exception as e:
        # This print is critical for debugging
        print(f"Error during word inference: {e}")
        return "[ERROR]"


def predict_sentence_pipeline(video_path: Path) -> Tuple[str, str]:
    """
    Runs the full A/V word-by-word prediction pipeline on a video file.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found at {video_path}")
        
    # Use a secure temp file for audio extraction
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_audio_file:
        temp_audio_path = tmp_audio_file.name
    
    try:
        # --- Step 1: Extract Audio from Video (as 16kHz, Mono) ---
        # Use subprocess.run for better control and error handling
        ffmpeg_command = [
            "ffmpeg", "-i", str(video_path), 
            "-vn", "-acodec", "pcm_s16le", "-ar", str(TARGET_SR), 
            "-ac", "1", temp_audio_path, "-y", "-hide_banner", "-loglevel", "error"
        ]
        
        result = subprocess.run(ffmpeg_command, check=False, 
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        if result.returncode != 0:
            raise RuntimeError("FFmpeg failed to extract audio. Check logs and FFmpeg installation.")
        
        if not os.path.exists(temp_audio_path):
            raise RuntimeError("FFmpeg failed to create audio file.")

        # --- Step 2: Run Whisper for Word-Level Timestamps ---
        # The whisper model is loaded globally
        if whisper_model is None:
                raise RuntimeError("Whisper model failed to load at startup.")

        result = whisper_model.transcribe(
            temp_audio_path, 
            language="en", 
            word_timestamps=True,
            # Use small or base model for faster inference on CPU
            # Depending on the speed requirement, you may need a faster device
            # or a smaller model.
            # model_name="base" 
        )
        
        # --- Step 3: Collect all word segments ---
        all_word_segments = []
        if "segments" in result:
            for segment in result["segments"]:
                if "words" in segment:
                    all_word_segments.extend(segment["words"])
        
        # Debugging print statement
        print("WHISPER FOUND WORDS:", all_word_segments)
        whisper_transcription = result.get("text", "")
        
        if not all_word_segments:
            return "Prediction failed: No words found.", whisper_transcription

        # --- Step 4: Load Video & Full Audio into Memory ---
        cap = cv2.VideoCapture(str(video_path))
        fps = cap.get(cv2.CAP_PROP_FPS)
        all_frames = []
        while True:
            ret, frame = cap.read()
            if not ret: break
            all_frames.append(frame)
        cap.release()

        # Check if video loaded correctly
        if not all_frames:
             return "Prediction failed: Could not load video frames.", whisper_transcription

        full_waveform, sr = torchaudio.load(temp_audio_path)
        
        # --- Step 5: Loop Through Words and Predict One-by-One ---
        predicted_sentence = []
        
        for word_data in all_word_segments:
            
            # ==================================================================
            # === FIX 2: Convert np.float64 to standard Python float ===
            # ==================================================================
            start_time = float(word_data['start'])
            end_time = float(word_data['end'])
            
            # 1. Get Video Clip Frames
            start_frame = int(start_time * fps)
            end_frame = int(end_time * fps)
            
            # Ensure indices are within bounds
            start_frame = max(0, start_frame)
            end_frame = min(len(all_frames), end_frame)

            # Check for empty frame lists *before* processing
            if start_frame >= end_frame:
                print(f"Skipping word '{word_data['word']}': No frames found between {start_frame} and {end_frame}.")
                continue # Skip to the next word
            
            # Resize BGR frames to Grayscale (H, W) for input
            word_video_frames_bgr = all_frames[start_frame : end_frame]
            
            word_video_frames_gray = [
                cv2.cvtColor(cv2.resize(f, (96, 96), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY) 
                for f in word_video_frames_bgr
            ]
            
            # 2. Get Audio Clip Waveform
            start_sample = int(start_time * sr)
            end_sample = int(end_time * sr)
            word_audio_waveform = full_waveform[:, start_sample:end_sample]
            
            # 3. Run our A/V Model
            predicted_word = run_inference_on_word(
                word_video_frames_gray, word_audio_waveform
            )
            
            if predicted_word:
                predicted_sentence.append(predicted_word)
        
        final_output = " ".join(predicted_sentence)
        return final_output, whisper_transcription
        
    finally:
        # --- Step 6: Clean up temporary audio file ---
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)


# ==============================================================================
# === 3. FASTAPI LIFECYCLE HOOKS ===
# ==============================================================================

@app.on_event("startup")
async def startup_event():
    """Initializes models and dependencies at startup."""
    global model, idx_to_word, whisper_model, mel_transform

    print("Initializing A/V model and Whisper...")
    try:
        # 1. Load Vocabulary
        if not VOCAB_PATH.exists():
            raise FileNotFoundError(f"FATAL: Vocabulary file not found at {VOCAB_PATH}")
            
        with open(VOCAB_PATH, 'r') as f:
            idx_to_word_str_keys = json.load(f)
            idx_to_word = {int(k): v for k, v in idx_to_word_str_keys.items()}

        num_classes = len(idx_to_word)

        # 2. Initialize and Load A/V Model
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"FATAL: Model weights not found at {MODEL_PATH}")
            
        model = AVWordClassifier(num_classes=num_classes).to(DEVICE)
        model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
        model.eval()

        # 3. Initialize Whisper Model (using a small or base model for speed/size)
        # Consider using a smaller model like 'base.en' if memory is an issue.
        whisper_model = whisper.load_model("small.en", device=DEVICE.type) 
        
        # 4. Initialize Mel Transform
        mel_transform = torchaudio.transforms.MelSpectrogram(
            sample_rate=TARGET_SR, n_fft=400, win_length=400, hop_length=160, n_mels=80
        ).to(DEVICE) # Move transform to device for potential GPU speedup

        print(f"Initialization successful. A/V Model on {DEVICE}. Whisper on {DEVICE}.")
    except Exception as e:
        print(f"FATAL: Failed to initialize dependencies: {e}")
        # Re-raise to prevent the server from starting with a broken state
        raise RuntimeError("Server initialization failed.")


# ==============================================================================
# === 4. API ENDPOINT ===
# ==============================================================================

@app.post("/predict_sentence/")
async def predict_sentence(video_file: UploadFile = File(...)):
    """
    Accepts a video file and runs the full A/V sentence prediction pipeline.
    """
    if model is None or whisper_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized. Server error.")

    # 1. Save the uploaded file to a temporary location
    temp_video_path = None
    try:
        # Create a temporary file to save the uploaded video content
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{video_file.filename}") as tmp:
            tmp.write(await video_file.read())
            temp_video_path = Path(tmp.name)

        # 2. Run the complex prediction pipeline
        model_prediction, whisper_transcription = predict_sentence_pipeline(temp_video_path)
        
        if model_prediction.startswith("Prediction failed"):
                raise HTTPException(status_code=400, detail=model_prediction)
        
        return JSONResponse(content={
            "model_prediction": model_prediction,
            "whisper_transcription": whisper_transcription,
            "status": "success"
        })

    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"Server error: {e}")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail="An unexpected server error occurred during prediction.")
    finally:
        # 3. Clean up the temporary file
        if temp_video_path and temp_video_path.exists():
            os.remove(temp_video_path)

# --- End of app.py ---