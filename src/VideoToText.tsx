import React, { useState, useRef } from 'react';
import { Upload, ArrowLeft, Loader, Download, Video } from 'lucide-react';

interface VideoToTextProps {
  onBack: () => void;
}

const VideoToText: React.FC<VideoToTextProps> = ({ onBack }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState<string>("");
  const [whisperText, setWhisperText] = useState<string>("");
  const [videoURL, setVideoURL] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Upload + Process ---
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setVideoURL(URL.createObjectURL(file));
      await processVideo(file, file.name);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const processVideo = async (source: File, fileName: string) => {
    setIsProcessing(true);
    setTranscription("");
    setWhisperText("");

    try {
      const formData = new FormData();
      formData.append('video_file', source, fileName);

      const response = await fetch('http://localhost:8000/predict_sentence/', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Server error: ${response.status}`);
      }

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

  // --- Download (optional if backend provides downloadable output) ---
  const downloadUploaded = () => {
    if (!uploadedFile) return;
    const a = document.createElement('a');
    a.href = videoURL;
    a.download = uploadedFile.name;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 pt-4">
          <button
            onClick={onBack}
            className="flex items-center text-blue-400 hover:text-blue-300 font-medium py-2 px-3 rounded-lg transition duration-150 bg-slate-700/50 hover:bg-slate-700"
            disabled={isProcessing}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <Video className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold tracking-tight">Video to Text</h1>
          </div>
          <div className="w-32"></div>
        </div>

        {/* Upload Section */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 p-8">
          <input
            type="file"
            ref={fileInputRef}
            accept="video/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <button
            onClick={handleUploadClick}
            disabled={isProcessing}
            className="w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition duration-200 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <Loader className="animate-spin h-5 w-5 mr-2" />
            ) : (
              <>
                <Upload size={20} />
                {uploadedFile ? `Re-upload Video` : 'Select Video File to Upload'}
              </>
            )}
          </button>

          {/* Video Preview */}
          {videoURL && (
            <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden mt-6">
              <video
                src={videoURL}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg flex items-center justify-center gap-3">
              <Loader className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent" />
              <p className="text-blue-200">Processing video...</p>
            </div>
          )}

          {/* Results */}
          {(transcription || whisperText) && !isProcessing && (
            <div className="mt-6 space-y-4">
              <div className="p-6 bg-slate-700 border border-slate-600 rounded-xl">
                <h3 className="text-xl font-semibold mb-2 text-green-400">
                  A/V Model Prediction:
                </h3>
                <p className="text-green-300 font-extrabold text-3xl break-words">
                  {transcription || "No prediction data."}
                </p>
              </div>
            </div>
          )}

          {/* Optional: Download uploaded video */}
          {uploadedFile && (
            <button
              onClick={downloadUploaded}
              className="w-full py-3 px-4 rounded-lg font-medium bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-500/40 mt-4 flex items-center justify-center gap-2"
            >
              <Download size={20} />
              Download Uploaded Video
            </button>
          )}
        </div>

        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>Built for the GEN AI Mock Interview project.</p>
        </div>
      </div>
    </div>
  );
};

export default VideoToText;
