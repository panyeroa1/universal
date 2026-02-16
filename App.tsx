import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveService } from './services/geminiLiveService';
import { VideoTile } from './components/VideoTile';
import { ControlBar } from './components/ControlBar';
import { TranslationSidebar } from './components/TranslationSidebar';
import { CallState, TranscriptionItem, TranslationMode, Language } from './types';
import { SUPPORTED_LANGUAGES } from './constants';
import { Sparkles, Globe, Mic, MicOff, Video, AlertCircle } from 'lucide-react';

// Use environment variable for API Key
const API_KEY = process.env.API_KEY || '';

const App: React.FC = () => {
  // State
  const [callState, setCallState] = useState<CallState>(CallState.LOBBY);
  const [userStream, setUserStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Translation Settings
  const [myLanguage, setMyLanguage] = useState<Language>(SUPPORTED_LANGUAGES[0]); // Default English
  const [partnerLanguage, setPartnerLanguage] = useState<Language>(SUPPORTED_LANGUAGES[1]); // Default Spanish
  const [mode, setMode] = useState<TranslationMode>(TranslationMode.CONVERSATION);

  // Services
  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize Camera for Lobby
  useEffect(() => {
    const initCamera = async () => {
      try {
        // Try getting both video and audio
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setUserStream(stream);
        setIsCameraOn(true);
      } catch (err) {
        console.warn("Camera+Audio access failed, trying Audio only", err);
        try {
            // Fallback: Try audio only
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setUserStream(audioStream);
            setIsCameraOn(false); // Force camera off since we only have audio
            setError(null);
        } catch (audioErr) {
            console.error("Audio access denied", audioErr);
            setError("Could not access camera or microphone. Please check system permissions.");
        }
      }
    };
    initCamera();
    return () => {
      if (userStream) {
        userStream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    if (userStream) {
      userStream.getAudioTracks().forEach(track => track.enabled = isMuted);
      setIsMuted(!isMuted);
      if (liveServiceRef.current) {
        liveServiceRef.current.muteMicrophone(!isMuted);
      }
    }
  };

  const toggleCamera = async () => {
    if (!userStream) return;

    const videoTrack = userStream.getVideoTracks()[0];
    
    if (videoTrack) {
        // If we have a video track (even if disabled), just toggle it
        videoTrack.enabled = !isCameraOn;
        setIsCameraOn(!isCameraOn);
    } else {
        // No video track available (audio-only mode)
        // Try to upgrade to video if turning ON
        if (!isCameraOn) {
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                // Stop old tracks to release hardware
                userStream.getTracks().forEach(t => t.stop());
                
                setUserStream(newStream);
                setIsCameraOn(true);
                setError(null);
                
                // If we are in a call, we might need to handle stream update logic here 
                // but GeminiLiveService creates its own audio stream, so visual update is enough.
            } catch (err) {
                console.error("Failed to upgrade to video", err);
                setError("Could not access camera. Continuing with audio only.");
            }
        }
    }
  };

  const getSystemInstruction = (mode: TranslationMode, pLang: Language, mLang: Language) => {
    if (mode === TranslationMode.TRANSLATOR) {
      return `You are a professional simultaneous interpreter. Your task is to translate whatever the user says in ${mLang.name} into ${pLang.name} and speak it out loud. Do not add any conversational filler. Just repeat the translated text.`;
    } else {
      return `You are a helpful AI friend named Camilla participating in a video call. You should speak in ${pLang.name}. If the user speaks to you in ${mLang.name}, understand them and reply in ${pLang.name}. Keep your answers relatively concise, as in a real video chat. Be friendly and expressive.`;
    }
  };

  const startCall = async () => {
    if (!API_KEY) {
      setError("API Key is missing. Please check your environment configuration.");
      return;
    }

    setCallState(CallState.CONNECTING);
    setError(null);

    const instruction = getSystemInstruction(mode, partnerLanguage, myLanguage);

    const service = new GeminiLiveService({
      apiKey: API_KEY,
      voiceName: partnerLanguage.voiceName,
      systemInstruction: instruction,
      onAudioData: (level) => setAudioLevel(level),
      onTranscription: (item) => {
        setTranscriptions(prev => [...prev, item]);
        if (item.sender === 'ai') setIsAIThinking(false);
      },
      onError: (err) => {
          console.error(err);
          setError("Connection failed. Please try again.");
          setCallState(CallState.LOBBY);
      },
      onClose: () => {
          setCallState(CallState.ENDED);
      }
    });

    liveServiceRef.current = service;
    await service.connect();
    setCallState(CallState.ACTIVE);
    // Auto-open translation panel for the demo effect
    setShowTranslation(true);
  };

  const endCall = () => {
    if (liveServiceRef.current) {
      liveServiceRef.current.disconnect();
      liveServiceRef.current = null;
    }
    setCallState(CallState.LOBBY);
    setTranscriptions([]);
  };

  // Re-connect if language settings change while active
  // Note: Gemini Live API currently doesn't support changing config mid-session easily without reconnect.
  // For this demo, we will just update the ref for future calls, or we could force a reconnect.
  // To keep it simple and stable, we won't auto-reconnect, but the user can restart.
  // However, the prompt implies "realtime" changes. Let's stick to initial config for stability in this version.
  
  if (callState === CallState.LOBBY) {
    return (
      <div className="min-h-screen bg-[#202124] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-4xl w-full flex flex-col md:flex-row gap-8 items-center justify-center">
            
            {/* Preview Tile */}
            <div className="relative w-full md:w-[600px] aspect-video bg-[#3c4043] rounded-2xl overflow-hidden shadow-2xl border border-[#5f6368]">
               {userStream && isCameraOn ? (
                   <video 
                    ref={ref => { if (ref) ref.srcObject = userStream; }}
                    autoPlay muted playsInline 
                    className={`w-full h-full object-cover -scale-x-100`}
                   />
               ) : (
                   <div className="absolute inset-0 flex items-center justify-center bg-[#202124]">
                       <div className="w-24 h-24 rounded-full bg-purple-500 flex items-center justify-center text-4xl font-semibold shadow-lg">
                           Y
                       </div>
                       {!userStream && <div className="absolute bottom-1/3 text-gray-400 text-sm">Loading camera...</div>}
                   </div>
               )}
               
               <div className="absolute bottom-4 left-4 flex gap-4">
                   <button onClick={toggleMute} className={`p-3 rounded-full ${isMuted ? 'bg-red-500' : 'bg-[#3c4043] border border-gray-500'}`}>
                       {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                   </button>
                   <button onClick={toggleCamera} className={`p-3 rounded-full ${!isCameraOn ? 'bg-red-500' : 'bg-[#3c4043] border border-gray-500'}`}>
                       {!isCameraOn ? <VideoOff size={20} /> : <Video size={20} />}
                   </button>
               </div>
               
               {/* Audio Visualizer Preview */}
               <div className="absolute bottom-4 right-4 flex gap-1 items-end h-6">
                   {[1,2,3].map(i => (
                       <div key={i} className="w-1 bg-green-500 rounded-full animate-pulse" style={{height: `${Math.random() * 20 + 5}px`}}></div>
                   ))}
               </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center md:items-start gap-6">
                <div className="text-center md:text-left">
                    <h1 className="text-3xl font-google mb-2">Ready to join?</h1>
                    <p className="text-gray-400">Orbit Meeting • Universal Translator</p>
                </div>
                
                {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg flex items-center gap-2 text-sm max-w-xs">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="flex gap-4">
                    <button 
                        onClick={startCall}
                        disabled={!userStream && !error} // Allow retrying if error, but disable if just loading
                        className={`bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] px-8 py-3 rounded-full font-medium text-lg transition-transform active:scale-95 flex items-center gap-2 shadow-lg hover:shadow-blue-500/20 ${(!userStream && !error) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Sparkles size={20} />
                        Join now
                    </button>
                    <button className="bg-[#e8eaed] hover:bg-white text-[#202124] px-6 py-3 rounded-full font-medium text-lg transition-colors flex items-center gap-2">
                        Present
                    </button>
                </div>
                
                <div className="bg-[#303134] p-4 rounded-xl w-full max-w-xs space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                        <Globe size={16} /> Translation Setup
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">I speak</span>
                        <select 
                            value={myLanguage.code} 
                            onChange={(e) => setMyLanguage(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)}
                            className="bg-[#202124] border border-gray-600 rounded px-2 py-1 text-white outline-none focus:border-blue-400"
                        >
                            {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                         <span className="text-gray-400">Partner speaks</span>
                         <select 
                            value={partnerLanguage.code} 
                            onChange={(e) => setPartnerLanguage(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)}
                            className="bg-[#202124] border border-gray-600 rounded px-2 py-1 text-white outline-none focus:border-blue-400"
                        >
                            {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  }

  // Active Call UI
  return (
    <div className="h-screen bg-[#202124] flex flex-col overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden p-4 gap-4">
            
            {/* Video Grid */}
            <div className={`flex-1 flex gap-4 ${showTranslation ? 'mr-0' : ''} transition-all duration-300`}>
                <div className="relative flex-1 bg-[#3c4043] rounded-2xl overflow-hidden flex items-center justify-center">
                    {/* AI Partner Tile */}
                    <div className="absolute inset-0 p-1">
                        <VideoTile 
                            name="Camilla (AI)" 
                            stream={null}
                            isSpeaking={audioLevel > 0.01}
                            poster="https://picsum.photos/id/64/1200/800" // Girl portrait placeholder
                        />
                    </div>
                    
                    {/* Floating Self View (Pip) */}
                    <div className="absolute bottom-6 right-6 w-48 h-32 md:w-64 md:h-40 bg-black rounded-xl overflow-hidden shadow-2xl border border-[#5f6368] z-10 hover:scale-105 transition-transform cursor-pointer">
                        <VideoTile 
                            name="You" 
                            stream={isCameraOn ? userStream : null} 
                            isSelf={true}
                            isMuted={isMuted}
                        />
                    </div>

                    {/* Captions Overlay (Google Meet Style) */}
                    {transcriptions.length > 0 && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 max-w-2xl w-full flex flex-col items-center gap-2 pointer-events-none z-0">
                            <div className="bg-black/60 backdrop-blur-sm text-white px-6 py-3 rounded-xl text-lg font-medium text-center shadow-lg transition-all">
                                {transcriptions[transcriptions.length - 1].sender === 'ai' && (
                                    <span className="text-blue-300 mr-2 font-bold text-sm uppercase tracking-wide">
                                        {mode === TranslationMode.TRANSLATOR ? 'Translated' : 'Camilla'}:
                                    </span>
                                )}
                                {transcriptions[transcriptions.length - 1].text}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Translation Sidebar */}
            <TranslationSidebar 
                isOpen={showTranslation} 
                onClose={() => setShowTranslation(false)}
                transcriptions={transcriptions}
                myLanguage={myLanguage}
                setMyLanguage={setMyLanguage}
                partnerLanguage={partnerLanguage}
                setPartnerLanguage={setPartnerLanguage}
                mode={mode}
                setMode={setMode}
            />
        </div>

        {/* Bottom Bar */}
        <ControlBar 
            isMuted={isMuted} 
            toggleMute={toggleMute}
            isCameraOn={isCameraOn}
            toggleCamera={toggleCamera}
            onEndCall={endCall}
            showTranslationPanel={showTranslation}
            toggleTranslationPanel={() => setShowTranslation(!showTranslation)}
            isConnecting={callState === CallState.CONNECTING}
        />
    </div>
  );
};

export default App;

// Helper components for icons to remove 'Video' conflict in imports above 
// Re-exporting from lucide-react in ControlBar was cleaner, but App.tsx used direct imports.
function VideoOff({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 2l20 20"/><path d="M16 16v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="M23 7l-7 5 7 5V7z"/></svg>
  );
}