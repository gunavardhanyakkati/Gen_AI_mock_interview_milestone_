import React, { useState, useRef } from 'react';
import { ArrowLeft, Upload, File, X, Mic, Loader } from 'lucide-react';

// --- MOCK PLACEHOLDERS ---
// Replace this with your actual import: import { transcribeAudio } from '../services/api';
const transcribeAudio = async (file: File) => {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const isError = file.name.toLowerCase().includes("error");
    if (isError) {
        throw new Error("Simulated API failure due to file name.");
    }
    return {
        text: `[Transcription Result for ${file.name}]: Your audio has been successfully processed by the transcription service. The result is a high-fidelity conversion of spoken words into text, ready for review and download.`
    };
};
// Replace this with your actual import: import TranscriptionDisplay from './TranscriptionDisplay';
const TranscriptionDisplay = ({ text, isLoading, onClear }) => {
    // This is a minimal mock for the UI logic below to work
    if (!text && !isLoading) return null;
    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto mt-4">
            <h3 className="text-lg font-semibold text-gray-800">Transcription Result</h3>
            <div className="bg-gray-50 rounded-lg p-4 mt-2">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {isLoading ? '...' : text}
                </p>
            </div>
            {/* Download/Copy/Clear buttons would go here based on your provided TranscriptionDisplay.tsx */}
        </div>
    );
};
// --- END MOCK PLACEHOLDERS ---

// --- Type Definitions ---
interface AudioToTextProps {
    onBack: () => void;
}

const AudioToText: React.FC<AudioToTextProps> = ({ onBack }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedFormats = ['.mp3', '.wav', '.m4a'];
  const maxFileSize = 50 * 1024 * 1024; // 50MB

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = (file: File) => {
    const fileNameLower = file.name.toLowerCase();
    
    // 1. Format Validation
    if (!acceptedFormats.some(format => fileNameLower.endsWith(format))) {
      alert(`Please select a valid audio file. Supported formats: ${acceptedFormats.join(', ')}`);
      return;
    }

    // 2. Size Validation
    if (file.size > maxFileSize) {
      alert(`File size must be less than ${formatFileSize(maxFileSize)}.`);
      return;
    }

    setSelectedFile(file);
    setTranscription('');
  };

  // --- Drag & Drop Handlers ---
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  // --- Input & Action Handlers ---
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUploadAndTranscribe = async () => {
    if (!selectedFile) return;

    setIsTranscribing(true);
    try {
      const result = await transcribeAudio(selectedFile);
      setTranscription(result.text);
    } catch (err) {
      console.error('Transcription failed:', err);
      setTranscription('Sorry, transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setTranscription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header and Back Button */}
        <div className="flex items-center justify-between mb-12">
            <button
                onClick={onBack}
                className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 transition-colors font-medium p-2 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
                disabled={isTranscribing}
            >
                <ArrowLeft size={20} />
                <span>Back to Dashboard</span>
            </button>
            <div className="flex items-center space-x-3">
                <Mic size={32} className="text-indigo-600" />
                <h1 className="text-3xl font-bold text-gray-800">Audio to Text Transcription</h1>
            </div>
            <div className="w-40"></div> {/* Spacer for alignment */}
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            
            {/* File Drop Area / File Selected View */}
            {!selectedFile ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer ${
                  dragOver 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="mb-4">
                  <Upload size={48} className={`mx-auto ${dragOver ? 'text-indigo-500' : 'text-gray-400'}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Drop your audio file here
                </h3>
                <p className="text-gray-600 mb-4">
                  or click to browse your files
                </p>
                <div className="bg-indigo-100 rounded-lg p-3 inline-block">
                  <p className="text-sm text-indigo-700 font-medium">
                    Supports: MP3, WAV, M4A • Max size: {formatFileSize(maxFileSize)}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptedFormats.join(',')}
                  onChange={handleFileInputChange}
                  className="hidden"
                  disabled={isTranscribing}
                />
              </div>
            ) : (
              <div className="text-center">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-center mb-4">
                    <File size={48} className="text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 truncate px-4">
                    {selectedFile.name}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Size: {formatFileSize(selectedFile.size)}
                  </p>
                  <button
                    onClick={handleClear}
                    className="text-red-600 hover:text-red-800 flex items-center space-x-1 mx-auto transition-colors disabled:opacity-50"
                    disabled={isTranscribing}
                  >
                    <X size={16} />
                    <span>Remove file</span>
                  </button>
                </div>

                <button
                  onClick={handleUploadAndTranscribe}
                  disabled={isTranscribing}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-4 rounded-full flex items-center space-x-3 mx-auto justify-center hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-emerald-500/40"
                >
                  {isTranscribing ? (
                    <Loader className="animate-spin h-6 w-6" />
                  ) : (
                    <Upload size={24} />
                  )}
                  <span className="font-semibold text-lg">
                    {isTranscribing ? 'Processing...' : 'Upload & Transcribe'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Transcription Results Display (uses the logic from TranscriptionDisplay.tsx) */}
          <TranscriptionDisplay 
            text={transcription}
            isLoading={isTranscribing}
            onClear={() => setTranscription('')}
          />
        </div>
      </div>
    </div>
  );
};

export default AudioToText;