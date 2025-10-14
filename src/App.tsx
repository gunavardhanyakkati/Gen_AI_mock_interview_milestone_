import { useState, useRef, useEffect } from 'react';
import { Video, Mic, Square, Download, Timer, VideoOff, MicOff, AlertCircle } from 'lucide-react';
import RecordRTC from 'recordrtc';

type RecordingMode = 'continuous' | 'timed';
type RecordingStatus = 'idle' | 'recording' | 'stopped';

function App() {
  const [mode, setMode] = useState<RecordingMode>('continuous');
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);
  const [timedDuration] = useState<number>(5);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopMediaStream();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  const requestPermissions = async () => {
    try {
      setPermissionError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: mode === 'continuous',
        audio: true
      });

      mediaStreamRef.current = stream;
      setHasPermissions(true);

      if (videoRef.current && mode === 'continuous') {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setPermissionError('Failed to access camera/microphone. Please grant permissions.');
      setHasPermissions(false);
    }
  };

  const stopMediaStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setHasPermissions(false);
  };

  const startRecording = async () => {
    if (!mediaStreamRef.current) {
      await requestPermissions();
      if (!mediaStreamRef.current) return;
    }

    const options: RecordRTC.Options = {
      type: mode === 'continuous' ? 'video' : 'audio',
      mimeType: mode === 'continuous' ? 'video/webm' : 'audio/webm',
      disableLogs: false
    };

    recorderRef.current = new RecordRTC(mediaStreamRef.current, options);
    recorderRef.current.startRecording();
    setStatus('recording');

    if (mode === 'timed') {
      setCountdown(timedDuration);
      let timeLeft = timedDuration;

      countdownIntervalRef.current = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);

        if (timeLeft <= 0) {
          stopRecording();
        }
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    recorderRef.current.stopRecording(() => {
      const blob = recorderRef.current!.getBlob();
      downloadRecording(blob);
      setStatus('stopped');
      setCountdown(0);

      recorderRef.current = null;
    });
  };

  const downloadRecording = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `recording-${mode}-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleModeChange = (newMode: RecordingMode) => {
    if (status === 'recording') return;

    stopMediaStream();
    setMode(newMode);
    setStatus('idle');
  };

  const handleStartStop = () => {
    if (status === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Video className="w-10 h-10 text-blue-400" />
            <h1 className="text-4xl font-bold tracking-tight">Media Recorder</h1>
          </div>
          <p className="text-slate-400 text-lg">WebRTC-powered video and audio recording</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => handleModeChange('continuous')}
                disabled={status === 'recording'}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  mode === 'continuous'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                } ${status === 'recording' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Video className="w-5 h-5" />
                Continuous Recording
              </button>
              <button
                onClick={() => handleModeChange('timed')}
                disabled={status === 'recording'}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  mode === 'timed'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                } ${status === 'recording' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Timer className="w-5 h-5" />
                Timed Recording ({timedDuration}s)
              </button>
            </div>
          </div>

          <div className="p-8">
            {permissionError && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-200">{permissionError}</p>
              </div>
            )}

            {mode === 'continuous' && (
              <div className="mb-8">
                <div className="relative bg-black rounded-xl overflow-hidden aspect-video shadow-2xl">
                  {hasPermissions ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <VideoOff className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">Camera preview will appear here</p>
                      </div>
                    </div>
                  )}

                  {status === 'recording' && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-red-600 rounded-full shadow-lg">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                      <span className="text-sm font-semibold">Recording</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {mode === 'timed' && (
              <div className="mb-8">
                <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video shadow-2xl flex items-center justify-center border border-slate-700">
                  {status === 'recording' ? (
                    <div className="text-center">
                      <div className="relative inline-block mb-4">
                        <Mic className="w-20 h-20 text-red-500 animate-pulse" />
                        <div className="absolute inset-0 bg-red-500 rounded-full opacity-20 animate-ping" />
                      </div>
                      <p className="text-6xl font-bold text-white mb-2">{countdown}</p>
                      <p className="text-slate-400">Recording audio...</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <MicOff className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400">Ready to record {timedDuration} seconds of audio</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-3">
                {!hasPermissions && status === 'idle' && (
                  <button
                    onClick={requestPermissions}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-green-600/30"
                  >
                    {mode === 'continuous' ? (
                      <>
                        <Video className="w-5 h-5" />
                        Enable Camera & Mic
                      </>
                    ) : (
                      <>
                        <Mic className="w-5 h-5" />
                        Enable Microphone
                      </>
                    )}
                  </button>
                )}

                {hasPermissions && (
                  <>
                    {status !== 'recording' && (
                      <button
                        onClick={handleStartStop}
                        className="flex items-center gap-2 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-lg transition-all shadow-lg shadow-red-600/30 hover:scale-105"
                      >
                        {mode === 'continuous' ? (
                          <>
                            <Video className="w-6 h-6" />
                            Start Recording
                          </>
                        ) : (
                          <>
                            <Mic className="w-6 h-6" />
                            Start Recording
                          </>
                        )}
                      </button>
                    )}

                    {status === 'recording' && mode === 'continuous' && (
                      <button
                        onClick={handleStartStop}
                        className="flex items-center gap-2 px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold text-lg transition-all shadow-lg"
                      >
                        <Square className="w-6 h-6" />
                        Stop Recording
                      </button>
                    )}
                  </>
                )}
              </div>

              {status === 'stopped' && (
                <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg flex items-center gap-3">
                  <Download className="w-5 h-5 text-green-400" />
                  <p className="text-green-200">Recording saved and downloaded successfully!</p>
                </div>
              )}

              <div className="text-center mt-4">
                <p className="text-slate-500 text-sm">
                  {mode === 'continuous'
                    ? 'Record video and audio until you stop manually'
                    : `Record ${timedDuration} seconds of audio automatically`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>Built with WebRTC & RecordRTC.js</p>
        </div>
      </div>
    </div>
  );
}

export default App;
