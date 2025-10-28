// src/components/VideoToTextWebcam.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import RecordRTC from 'recordrtc';
import { Video, Square, Download, AlertCircle, ArrowLeft, Loader } from 'lucide-react';

interface VideoToTextWebcamProps {
  onBack: () => void;
}

const VideoToTextWebcam: React.FC<VideoToTextWebcamProps> = ({ onBack }) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'stopped'>('idle');
  const [hasPermissions, setHasPermissions] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [transcription, setTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastRecording, setLastRecording] = useState<Blob | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);

  const stopMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }
    setHasPermissions(false);
  }, []);

  useEffect(() => {
    requestPermissions();
    return () => stopMediaStream();
  }, [stopMediaStream]);

  const requestPermissions = async () => {
    stopMediaStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      mediaStreamRef.current = stream;
      setHasPermissions(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(err => console.error(err));
      }
    } catch (err) {
      console.error('Permission error:', err);
      setPermissionError('Camera/mic access denied.');
    }
  };

  const startRecording = () => {
    if (!mediaStreamRef.current) return;
    recorderRef.current = new RecordRTC(mediaStreamRef.current, { type: 'video', mimeType: 'video/webm' });
    recorderRef.current.startRecording();
    setStatus('recording');
    setTranscription('');
    setLastRecording(null);
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;
    recorderRef.current.stopRecording(async () => {
      const blob = recorderRef.current!.getBlob();
      setStatus('stopped');
      setLastRecording(blob);
      await processVideo(blob, 'recorded_video.webm');
      recorderRef.current = null;
    });
  };

 const processVideo = async (source: Blob, fileName: string) => {
  setIsProcessing(true);
  try {
    const formData = new FormData();
    formData.append('video_file', source, fileName); // same key expected by backend

    const response = await fetch('http://localhost:8000/predict_sentence/', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // 👇 Only display Whisper’s transcription
    setTranscription(data.whisper_transcription || 'No Whisper output.');
  } catch (err) {
    console.error(err);
    setTranscription('Transcription failed.');
  } finally {
    setIsProcessing(false);
  }
};


  const downloadRecording = () => {
    if (!lastRecording) return;
    const url = URL.createObjectURL(lastRecording);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
      <div className="container mx-auto max-w-5xl">
        <div className="flex justify-between items-center mb-8 pt-4">
          <button
            onClick={onBack}
            className="flex items-center text-blue-400 hover:text-blue-300 font-medium py-2 px-3 rounded-lg transition bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50"
            disabled={isProcessing || status === 'recording'}
          >
            <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <Video className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold">Video to Text (Webcam)</h1>
          </div>
          <div className="w-32"></div>
        </div>

        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8">
          <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden relative mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
              style={{ transform: 'scaleX(-1)' }}
            />
            {status === 'recording' && (
              <div className="absolute top-4 left-4 flex items-center bg-red-600/80 px-3 py-1 rounded-full text-sm font-semibold">
                <Square className="w-3 h-3 fill-white mr-2" /> RECORDING
              </div>
            )}
          </div>

          {permissionError && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg mb-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p>{permissionError}</p>
            </div>
          )}

          <button
            onClick={status === 'recording' ? stopRecording : startRecording}
            disabled={isProcessing || !hasPermissions}
            className={`w-full py-3 rounded-lg font-medium transition ${
              status === 'recording'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isProcessing ? <Loader className="animate-spin h-5 w-5 mx-auto" /> : status === 'recording' ? 'Stop Recording & Process' : 'Start Recording'}
          </button>

          {isProcessing && (
            <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg flex items-center justify-center gap-3">
              <Loader className="animate-spin h-5 w-5" />
              <p>Processing video...</p>
            </div>
          )}

          {transcription && !isProcessing && (
            <div className="mt-6 p-6 bg-slate-700 border border-slate-600 rounded-xl">
              <h3 className="text-xl font-semibold mb-2 text-green-400">Prediction:</h3>
              <p className="text-green-300 text-2xl font-bold">{transcription}</p>
            </div>
          )}

          {status === 'stopped' && lastRecording && (
            <button
              onClick={downloadRecording}
              className="w-full py-3 rounded-lg mt-4 bg-teal-600 hover:bg-teal-700 flex items-center justify-center gap-2"
            >
              <Download size={20} /> Download Recorded Video
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoToTextWebcam;
