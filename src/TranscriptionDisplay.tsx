import React from 'react';
import { Copy, Download, RotateCcw } from 'lucide-react';

interface TranscriptionDisplayProps {
  text: string;
  isLoading: boolean;
  onClear: () => void;
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({ 
  text, 
  isLoading, 
  onClear 
}) => {
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const downloadAsText = () => {
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `transcription-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Processing your audio...</p>
        </div>
      </div>
    );
  }

  if (!text) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Transcription Result</h3>
        <div className="flex space-x-2">
          <button
            onClick={copyToClipboard}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <Copy size={16} />
            <span className="text-sm">Copy</span>
          </button>
          <button
            onClick={downloadAsText}
            className="flex items-center space-x-2 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
          >
            <Download size={16} />
            <span className="text-sm">Download</span>
          </button>
          <button
            onClick={onClear}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RotateCcw size={16} />
            <span className="text-sm">Clear</span>
          </button>
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
};

export default TranscriptionDisplay;