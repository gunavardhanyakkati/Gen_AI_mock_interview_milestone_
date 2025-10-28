import React, { useState } from "react";
import { LogOut, Mic, Video } from "lucide-react";
import AudioToText from './AudioToText'; // Assuming this is the path
import VideoToText from "./VideoToText"; // Assuming this is the path

// Define a type for the current view state
type View = "home" | "audio" | "video";

// Define the props for the Home component
interface HomeProps {
  user: {
    displayName: string | null;
    email: string | null;
  };
  onSignOut: () => void;
}

const Home: React.FC<HomeProps> = ({ user, onSignOut }) => {
  const [currentView, setCurrentView] = useState<View>("home");

  // Get the user's name or email for display
  const userName = user.displayName || user.email || "User";

  // Render the appropriate component based on the currentView state
  if (currentView === "audio") {
    return <AudioToText onBack={() => setCurrentView("home")} />;
  }

  if (currentView === "video") {
    return <VideoToText onBack={() => setCurrentView("home")} />;
  }

  // Render the main Home dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-extrabold text-indigo-700 tracking-tight">
            GEN AI MOCK INTERVIEW
          </h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700 font-medium hidden sm:inline">
              Welcome, {userName}!
            </span>
            <button
              onClick={onSignOut}
              className="flex items-center text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition duration-150 ease-in-out font-medium"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5 mr-1" />
              Sign Out
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">
          AI Transcription Services
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Audio to Text Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition duration-300 transform hover:-translate-y-1 border border-indigo-100">
            <Mic className="w-10 h-10 text-indigo-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Audio to Text Transcription
            </h3>
            <p className="text-gray-600 mb-6">
              Convert speech from audio files (MP3, WAV, etc.) into accurate,
              written text instantly. Ideal for meeting recordings and podcasts.
            </p>
            <button
              onClick={() => setCurrentView("audio")}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150"
            >
              Start Audio Transcription
            </button>
          </div>

          {/* Video to Text Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition duration-300 transform hover:-translate-y-1 border border-teal-100">
            <Video className="w-10 h-10 text-teal-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Video to Text Transcription
            </h3>
            <p className="text-gray-600 mb-6">
              Extract and transcribe dialogue from video files. Perfect for
              creating subtitles, summaries, and searchable content.
            </p>
            <button
              onClick={() => setCurrentView("video")}
              className="w-full bg-teal-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-500 focus:ring-opacity-50 transition duration-150"
            >
              Start Video Transcription
            </button>
          </div>
        </div>
      </main>
      
      {/* Footer (Optional) */}
      <footer className="mt-12 py-4 text-center text-sm text-gray-500 border-t border-gray-200">
        © 2025 GEN AI Interview Project. All rights reserved.
      </footer>
    </div>
  );
};

export default Home;