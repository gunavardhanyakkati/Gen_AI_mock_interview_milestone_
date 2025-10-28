import React, { useState, useEffect } from "react";
// Import Home, AudioToText, and VideoToText to complete the component tree
import Home from "./Home";


import { initializeApp } from "firebase/app";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  User, // Import User type from firebase/auth
} from "firebase/auth";

import {
  CheckCircle,
  AlertCircle,
  Mail,
  Upload,
  Video,
  Loader,
  Download,
} from "lucide-react";

import SignIn from './auth/SignIn';
import SignUp from './auth/SignUp';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCxx3cuoG1wFNcEoYP4iLVjeeJVwDrCkC8",
  authDomain: "genai-mock-interview-auth.firebaseapp.com",
  projectId: "genai-mock-interview-auth",
  storageBucket: "genai-mock-interview-auth.firebasestorage.app",
  messagingSenderId: "711293444002",
  appId: "1:711293444002:web:15e233e1dbc1f1349adcfb",
  measurementId: "G-L8QN8MD2ED",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

// --- Component Props Types ---
interface EmailVerificationMessageProps {
  user: User; // User type from firebase/auth
}

// --- Email Verification Message Component ---
const EmailVerificationMessage: React.FC<EmailVerificationMessageProps> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      const { sendEmailVerification } = await import("firebase/auth");
      await sendEmailVerification(user);
      setMessage("Verification email sent successfully!");
      setTimeout(() => setMessage(""), 5000);
    } catch (error) {
      setMessage("Failed to send verification email. Please try again.");
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Verify Your Email
        </h1>
        <p className="text-gray-600 mb-6">
          We've sent a verification link to <strong>{user.email}</strong>.
          Please check your email and click the verification link to access your
          account.
        </p>

        {message && (
          <div
            className={`p-3 rounded-lg mb-4 text-sm ${
              message.includes("successfully")
                ? "bg-green-50 text-green-600 border border-green-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}
          >
            {message}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleResendVerification}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Resend Verification Email"}
          </button>

          <button
            onClick={handleSignOut}
            className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Sign Out
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          <p>
            Didn't receive the email? Check your spam folder or try resending.
          </p>
        </div>
      </div>
    </div>
  );
};

// --- Loading Screen Component ---
const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading your account...</p>
      </div>
    </div>
  );
};

// --- Configuration Error Component ---
const ConfigurationError: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Firebase Configuration Required
        </h1>
        <p className="text-gray-600 mb-6">
          Please replace the placeholder Firebase configuration in App.tsx with
          your actual Firebase project configuration.
        </p>
        <div className="bg-gray-100 p-4 rounded-lg text-left">
          <p className="text-sm text-gray-700 mb-2 font-medium">Setup Steps:</p>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Create a Firebase project</li>
            <li>Enable Email/Password Authentication</li>
            <li>Get your web app configuration</li>
            <li>Replace the firebaseConfig object in App.tsx</li>
          </ol>
        </div>
        <div className="mt-4">
          <a
            href="https://console.firebase.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            Go to Firebase Console →
          </a>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---
const App: React.FC = () => {
  // Define type for authentication view
  type AuthView = "signin" | "signup";
  
  // State for view, user (can be firebase User or null), loading, and initialization
  const [currentView, setCurrentView] = useState<AuthView>("signin");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Check if Firebase is properly configured
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "your-api-key") {
      setLoading(false);
      return;
    }

    // Set up auth state listener for persistent login
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      setAuthInitialized(true);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentView("signin");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleSwitchToSignUp = () => {
    setCurrentView("signup");
  };

  const handleSwitchToSignIn = () => {
    setCurrentView("signin");
  };

  // Show configuration error if Firebase is not set up
  if (
    !loading &&
    (!firebaseConfig.apiKey || firebaseConfig.apiKey === "your-api-key")
  ) {
    return <ConfigurationError />;
  }

  // Show loading screen while checking auth state
  if (loading || !authInitialized) {
    return <LoadingScreen />;
  }

  // If user is logged in
  if (user) {
    // Google users don't need email verification, regular email users do
    const isGoogleUser = user.providerData.some(
      (provider) => provider.providerId === "google.com",
    );

    if (!isGoogleUser && !user.emailVerified) {
      // TypeScript safety: user is not null here.
      return <EmailVerificationMessage user={user} />;
    }
    // Show dashboard for verified users or Google users
    return <Home user={user} onSignOut={handleSignOut} />;
  }

  // Show authentication forms for non-authenticated users
  if (currentView === "signup") {
    // Assuming SignUp component has onSwitchToSignIn prop
    return <SignUp onSwitchToSignIn={handleSwitchToSignIn} />;
  }

  // Assuming SignIn component has onSwitchToSignUp prop
  return <SignIn onSwitchToSignUp={handleSwitchToSignUp} />;
};

export default App;