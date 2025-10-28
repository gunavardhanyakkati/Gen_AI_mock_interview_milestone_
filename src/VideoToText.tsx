import React, { useState, useRef, useEffect, useCallback } from 'react';
import RecordRTC from 'recordrtc';
import { Video, Square, Download, VideoOff, AlertCircle, Upload, Webcam, ArrowLeft, Loader } from 'lucide-react';

// --- Type Definitions ---
type RecordingStatus = 'idle' | 'recording' | 'stopped';
type InputMode = 'webcam' | 'upload';

interface VideoToTextProps {
  onBack: () => void;
}

const VideoToText: React.FC<VideoToTextProps> = ({ onBack }) => {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [inputMode, setInputMode] = useState<InputMode>('webcam');
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string>('');
  const [transcription, setTranscription] = useState<string>(""); // A/V Model Prediction
  const [whisperText, setWhisperText] = useState<string>(""); // Whisper Transcription
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [lastRecording, setLastRecording] = useState<Blob | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Utility Functions ---

  const stopMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.load(); // Reload video element
    }
    setHasPermissions(false);
  }, []);

  useEffect(() => {
    // Attempt to get permissions and start webcam if inputMode is 'webcam' initially
    if (inputMode === 'webcam') {
        requestPermissions();
    }
    
    // Cleanup on unmount
    return () => {
      stopMediaStream();
    };
  }, [stopMediaStream]);

  const requestPermissions = async () => {
    stopMediaStream(); // Stop any existing streams
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
      setUploadedFile(null);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (error) {
          console.error('Error playing video stream:', error);
        }
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setPermissionError('Failed to access camera/microphone. Please grant permissions and try again.');
      setHasPermissions(false);
    }
  };

  const startRecording = async () => {
    if (!mediaStreamRef.current) {
      // Request permissions if not already granted
      await requestPermissions();
      if (!mediaStreamRef.current) return;
    }

    const options: RecordRTC.Options = {
      type: 'video',
      mimeType: 'video/webm',
      disableLogs: false
    };

    recorderRef.current = new RecordRTC(mediaStreamRef.current, options);
    recorderRef.current.startRecording();
    setStatus('recording');
    setTranscription("");
    setWhisperText("");
    setLastRecording(null);
  };

  /**
   * Main function to send data to the backend, handles both Blob (from recording) and File (from upload)
   * @param source The video data source (Blob or File)
   * @param fileName The name to use for the file in the FormData
   */
  const processVideo = async (source: Blob | File, fileName: string) => {
    setIsProcessing(true);
    setTranscription("");
    setWhisperText("");

    try {
      const formData = new FormData();
      formData.append('video_file', source, fileName);

      // NOTE: This URL assumes a local FastAPI server is running at port 8000.
      const response = await fetch('http://localhost:8000/predict_sentence/', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle API errors sent by the server
        throw new Error(data.detail || `Server error: ${response.status}`);
      }

      console.log("A/V Prediction:", data.model_prediction);
      console.log("Whisper Transcription:", data.whisper_transcription);

      setTranscription(data.model_prediction || "No AV Prediction received.");
      setWhisperText(data.whisper_transcription || "No Whisper Transcription received.");

    } catch (error) {
      console.error('Error processing video:', error);
      setTranscription("Processing Failed.");
      setWhisperText(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;

    // Type assertion to ensure React knows the ref is not null inside this callback
    recorderRef.current.stopRecording(async () => {
      const blob = recorderRef.current!.getBlob();
      setStatus('stopped');
      setLastRecording(blob); // Save blob for download

      // Process recorded video (Blob)
      await processVideo(blob, 'recorded_video.webm');

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
      setLastRecording(null);
      stopMediaStream(); // Ensure webcam stream is stopped
      
      // Display the uploaded video file in the video element
      if (videoRef.current) {
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
    if (status === 'recording') {
        // Prevent changing mode while recording
        alert("Please stop the current recording before changing input mode.");
        return;
    }

    setInputMode(mode);
    // Clean up previous mode states
    stopMediaStream();
    setUploadedFile(null);
    setStatus('idle');
    setTranscription("");
    setWhisperText("");
    setLastRecording(null);
    if (videoRef.current) videoRef.current.src = '';
    
    // Auto-request permissions if switching to webcam
    if (mode === 'webcam') {
        requestPermissions();
    }
  };

  // --- Download ---

  const downloadRecording = () => {
    if (!lastRecording) return;

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
      <div className="container mx-auto max-w-5xl">
        {/* Header & Back Button */}
        <div className="flex justify-between items-center mb-8 pt-4">
            <button
                onClick={onBack}
                className="flex items-center text-blue-400 hover:text-blue-300 font-medium py-2 px-3 rounded-lg transition duration-150 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50"
                disabled={isProcessing || status === 'recording'}
            >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
            </button>
            <div className="flex items-center gap-3">
              <Video className="w-8 h-8 text-blue-400" />
              <h1 className="text-3xl font-bold tracking-tight">Video to Text</h1>
            </div>
            <div className="w-32"></div> {/* Spacer for alignment */}
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="p-8">

            {/* --- Mode Toggle --- */}
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => handleModeChange('webcam')}
                disabled={isProcessing}
                className={`py-2 px-4 rounded-lg flex items-center gap-2 transition ${inputMode === 'webcam' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  } disabled:opacity-50`}
              >
                <Webcam size={20} /> Use Webcam
              </button>
              <button
                onClick={() => handleModeChange('upload')}
                disabled={isProcessing}
                className={`py-2 px-4 rounded-lg flex items-center gap-2 transition ${inputMode === 'upload' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  } disabled:opacity-50`}
              >
                <Upload size={20} /> Upload File
              </button>
            </div>

            {/* Video/Webcam Display Area */}
            <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden relative mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={inputMode === 'webcam'} // Mute only the live feed
                controls={inputMode === 'upload' || status === 'stopped'} // Show controls for files
                className="w-full h-full object-contain"
                style={{ transform: inputMode === 'webcam' ? 'scaleX(-1)' : 'none' }}
              />
              {status === 'recording' && (
                <div className="absolute top-4 left-4 flex items-center bg-red-600/80 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  <Square className="w-3 h-3 fill-white mr-2" /> RECORDING
                </div>
              )}
            </div>

            {/* Permission Error Display */}
            {permissionError && (
              <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg mb-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
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
                disabled={isProcessing || !hasPermissions}
                className={`w-full py-3 px-4 rounded-lg font-medium transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${status === 'recording'
                    ? 'bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/40'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/40'
                  }`}
              >
                {isProcessing ? <Loader className="animate-spin h-5 w-5 mx-auto" /> : status === 'recording' ? 'Stop Recording & Process' : 'Start Recording'}
              </button>
            )}

            {inputMode === 'upload' && (
              <button
                onClick={handleUploadClick}
                disabled={isProcessing}
                className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${uploadedFile
                    ? 'bg-green-600 hover:bg-green-700 shadow-md shadow-green-500/40'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/40'
                  }`}
              >
                {isProcessing ? (
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                ) : (
                  <>
                    <Upload size={20} /> 
                    {uploadedFile ? `Process: ${uploadedFile.name.substring(0, 30)}${uploadedFile.name.length > 30 ? '...' : ''}` : 'Select Video File to Upload'}
                  </>
                )}
              </button>
            )}

            {/* --- Processing & Transcription Display --- */}
            {isProcessing && (
              <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg flex items-center justify-center gap-3">
                <Loader className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent" />
                <p className="text-blue-200">Processing video...</p>
              </div>
            )}

            {/* Results Display */}
            {(transcription || whisperText) && !isProcessing && (
              <div className="mt-6 space-y-4">
                <div className="p-6 bg-slate-700 border border-slate-600 rounded-xl">
                  <h3 className="text-xl font-semibold mb-2 text-green-400">A/V Model Prediction:</h3>
                  <p className="text-green-300 font-extrabold text-3xl break-words">{transcription || "No prediction data."}</p>
                </div>

                <div className="p-6 bg-slate-700 border border-slate-600 rounded-xl">
                  <h3 className="text-xl font-semibold mb-2 text-blue-400">Whisper Transcription:</h3>
                  <p className="text-blue-300 text-2xl break-words">{whisperText || "No transcription data."}</p>
                </div>

                {/* Download option only makes sense for recorded videos */}
                {inputMode === 'webcam' && status === 'stopped' && lastRecording && (
                  <button
                    onClick={downloadRecording}
                    className="w-full py-3 px-4 rounded-lg font-medium bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-500/40 mt-4 flex items-center justify-center gap-2"
                  >
                    <Download size={20} />
                    Download Recorded Video
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>Built for the GEN AI Mock Interview project.</p>
        </div>
      </div>
    </div>
  );
}

export default VideoToText;
