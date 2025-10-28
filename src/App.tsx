import { useState, useRef, useEffect, useCallback } from 'react';
import { Video, Square, Download, VideoOff, AlertCircle, Upload, Webcam } from 'lucide-react';
import RecordRTC from 'recordrtc';

type RecordingStatus = 'idle' | 'recording' | 'stopped';
type InputMode = 'webcam' | 'upload'; // New state to track input mode

function App() {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [inputMode, setInputMode] = useState<InputMode>('webcam'); // Default to webcam
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string>('');
  const [transcription, setTranscription] = useState<string>("");
  // Adding state for whisper text, as the API provides it
  const [whisperText, setWhisperText] = useState<string>(""); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [lastRecording, setLastRecording] = useState<Blob | null>(null); // To hold blob for download

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input

  // --- Utility Functions ---

  const stopMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setHasPermissions(false);
  }, []);

  useEffect(() => {
    return () => {
      stopMediaStream();
    };
  }, [stopMediaStream]);

  const requestPermissions = async () => {
    // ... (Existing requestPermissions logic)
    try {
      setPermissionError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      mediaStreamRef.current = stream;
      setHasPermissions(true);
      setUploadedFile(null); // Clear uploaded file when starting webcam

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (error) {
          console.error('Error playing video:', error);
        }
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setPermissionError('Failed to access camera/microphone. Please grant permissions.');
      setHasPermissions(false);
    }
  };

  const startRecording = async () => {
    if (!mediaStreamRef.current) {
      await requestPermissions();
      if (!mediaStreamRef.current) return;
    }

    // ... (Existing startRecording logic)
    const options: RecordRTC.Options = {
      type: 'video',
      mimeType: 'video/webm',
      disableLogs: false
    };

    recorderRef.current = new RecordRTC(mediaStreamRef.current, options);
    recorderRef.current.startRecording();
    setStatus('recording');
    setTranscription(""); // Clear old result
    setWhisperText(""); // Clear old result
    setLastRecording(null); // Clear last recording
  };

  /**
    * Main function to send data to the backend, handles both Blob (from recording) and File (from upload)
    * @param source The video data source (Blob or File)
    * @param fileName The name to use for the file in the FormData
    */
  const processVideo = async (source: Blob | File, fileName: string) => {
    setIsProcessing(true);
    setTranscription(""); // Clear any previous transcription
    setWhisperText(""); // Clear any previous transcription

    try {
      const formData = new FormData();
      // Use 'video_file' key to match the FastAPI endpoint: predict_word(video_file: UploadFile = File(...))
      formData.append('video_file', source, fileName);

      const response = await fetch('http://localhost:8000/predict_sentence/', {
        method: 'POST',
        body: formData,
      });

      // ===================================================================
      // === THE FIX IS HERE ===
      // ===================================================================
      
      // 1. Read the JSON response body ONE TIME.
      const data = await response.json();

      // 2. Check if the response was NOT successful (e.g., 400 or 500 error)
      if (!response.ok) {
        // FastAPI sends errors in a "detail" field.
        // Throw an error with that message.
        throw new Error(data.detail || `Server error: ${response.status}`);
      }

      // 3. If we are here, the response was successful (200 OK).
      // We do NOT need to call response.json() again.
      // We use the 'data' variable we already read.

      console.log("A/V Prediction:", data.model_prediction);
      console.log("Whisper Transcription:", data.whisper_transcription);
      
      // Use data.model_prediction to set your transcription state
      setTranscription(data.model_prediction);
      setWhisperText(data.whisper_transcription); // Also set the whisper text

    } catch (error) {
      console.error('Error processing video:', error);
      alert(`Failed to process video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;

    recorderRef.current.stopRecording(async () => {
      const blob = recorderRef.current!.getBlob();
      setStatus('stopped');
      setLastRecording(blob); // Save blob for download

      // Process recorded video (Blob)
      await processVideo(blob, 'recorded_video.webm');

      // downloadRecording(blob); // Optionally keep download
      recorderRef.current = null;
    });
  };

  // --- Upload Handlers ---

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setTranscription("");
      setWhisperText("");
      setLastRecording(null); // Clear any recording
      // Display the uploaded video file in the video element (optional)
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(file);
        videoRef.current.play().catch(err => console.error('Error playing uploaded file:', err));
      }
    }
  };

  const handleUploadClick = () => {
    if (uploadedFile) {
      // Process the existing uploaded file
      processVideo(uploadedFile, uploadedFile.name);
    } else {
      // Open the file dialog if no file is selected
      fileInputRef.current?.click();
    }
  };

  const handleModeChange = (mode: InputMode) => {
    setInputMode(mode);
    // Clean up previous mode
    stopMediaStream();
    setUploadedFile(null);
    setStatus('idle');
    setTranscription("");
    setWhisperText("");
    setLastRecording(null);
    if (videoRef.current) videoRef.current.src = '';
  };

  // --- Rendering and UI ---

  const downloadRecording = () => {
    if (!lastRecording) return; // Use the blob from state

    const url = URL.createObjectURL(lastRecording);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="text-center mb-12">
          {/* ... (Header) */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <Video className="w-10 h-10 text-blue-400" />
            <h1 className="text-4xl font-bold tracking-tight">AV Word Classifier</h1>
          </div>
          <p className="text-slate-400 text-lg">Process video via Webcam or File Upload</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="p-8">

            {/* --- Mode Toggle --- */}
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => handleModeChange('webcam')}
                className={`py-2 px-4 rounded-lg flex items-center gap-2 transition ${inputMode === 'webcam' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
              >
                <Webcam size={20} /> Use Webcam
              </button>
              <button
                onClick={() => handleModeChange('upload')}
                className={`py-2 px-4 rounded-lg flex items-center gap-2 transition ${inputMode === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
              >
                <Upload size={20} /> Upload File
              </button>
            </div>

            <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden relative mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain" // Use 'object-contain' for uploaded files
                style={{ transform: inputMode === 'webcam' ? 'scaleX(-1)' : 'none' }}
              />
            </div>

            {permissionError && (
              <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg mb-4">
                <p className="text-red-200">{permissionError}</p>
              </div>
            )}

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* --- Action Buttons based on Mode --- */}
            {inputMode === 'webcam' && (
              <button
                onClick={status === 'recording' ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`w-full py-3 px-4 rounded-lg font-medium ${status === 'recording'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                {status === 'recording' ? 'Stop Recording & Process' : 'Start Recording'}
              </button>
            )}

            {inputMode === 'upload' && (
              <>
                <button
                  onClick={handleUploadClick}
                  disabled={isProcessing}
                  className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 ${uploadedFile
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                  {uploadedFile ? (
                    <>
                      <Upload size={20} /> Process Uploaded File
                    </>
                  ) : (
                    <>
                      <Upload size={20} /> Select Video File
                    </>
                  )}
                </button>
                {uploadedFile && (
                  <p className="text-center text-slate-400 mt-2">File ready to process: {uploadedFile.name}</p>
                )}
              </>
            )}

            {/* --- Processing & Transcription Display --- */}
            {isProcessing && (
              <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent" />
                <p className="text-blue-200">Processing video...</p>
              </div>
            )}

            {/* Updated to show both results */}
            {(transcription || whisperText) && !isProcessing && (
              <div className="mt-4 space-y-4">
                <div className="p-4 bg-slate-700/50 border border-slate-600 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">A/V Model Prediction:</h3>
                  <p className="text-green-300 font-bold text-2xl">{transcription || "..."}</p>
                </div>

               <div className="p-4 bg-slate-700/50 border border-slate-600 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Whisper Transcription:</h3>
                  <p className="text-blue-300 text-xl">{whisperText || "..."}</p>
                </div>

                {/* Download option only makes sense for recorded videos */}
                {inputMode === 'webcam' && status === 'stopped' && lastRecording && (
                  <button
                    onClick={downloadRecording}
                    className="w-full py-3 px-4 rounded-lg font-medium bg-green-600 hover:bg-green-700"
                  >
                    <Download size={20} className="inline-block mr-2" />
                    Download Recording
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>Built with WebRTC & RecordRTC.js, powered by FastAPI & PyTorch.</p>
        </div>
      </div>
    </div>
  );
}

export default App;

