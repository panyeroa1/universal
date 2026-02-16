import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveService } from './services/geminiLiveService';
import { VideoTile } from './components/VideoTile';
import { ControlBar } from './components/ControlBar';
import { TranslationSidebar } from './components/TranslationSidebar';
import { CallState, TranscriptionItem, TranslationMode, Language } from './types';
import { SUPPORTED_LANGUAGES } from './constants';
import { Sparkles, Globe, Mic, MicOff, Video, VideoOff, AlertCircle, RefreshCw } from 'lucide-react';

// Use environment variable for API Key
const API_KEY = process.env.API_KEY || '';

export const App: React.FC = () => {
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
  const streamRef = useRef<MediaStream | null>(null); // Ref to track stream for cleanup

  const requestMedia = useCallback(async () => {
    setError(null);
    
    // Check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Media devices not supported in this browser or context (requires HTTPS).");
      return;
    }

    try {
      // Stop existing tracks if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setUserStream(null);
      }

      // First try requesting both
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setUserStream(stream);
      setIsCameraOn(true);
      setError(null);
    } catch (err) {
      console.warn("Camera+Audio access failed, trying Audio only", err);
      // If video fails (e.g. no camera), try audio only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = audioStream;
        setUserStream(audioStream);
        setIsCameraOn(false);
        setError(null);
      } catch (audioErr) {
        console.error("Audio access denied", audioErr);
        setError("Permission denied. Please allow access to camera and microphone.");
      }
    }
  }, []);

  // Initialize Camera for Lobby
  useEffect(() => {
    requestMedia();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [requestMedia]);

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
    if (!userStream) {
        // If no stream exists (e.g. initial error), try to request full media again
        await requestMedia();
        return;
    }

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
                
                // Stop old audio-only stream
                userStream.getTracks().forEach(t => t.stop());
                
                streamRef.current = newStream;
                setUserStream(newStream);
                setIsCameraOn(true);
                setError(null);
            } catch (err) {
                console.error("Failed to upgrade to video", err);
                setError("Could not access camera. Continuing with audio only.");
            }
        }
    }
  };

  const getSystemInstruction = (mode: TranslationMode, pLang: Language, mLang: Language) => {
    if (mode === TranslationMode.TRANSLATOR) {
      return `You are a professional bi-directional simultaneous interpreter. 
      You will hear a conversation between a ${mLang.name} speaker and a ${pLang.name} speaker. 
      
      Instructions:
      1. If you hear speech in ${mLang.name}, translate it immediately to ${pLang.name} and speak it out.
      2. If you hear speech in ${pLang.name}, translate it immediately to ${mLang.name} and speak it out.
      3. Do not participate in the conversation. Do not say "Okay" or "I understand". Just translate.
      4. Maintain the tone and urgency of the speaker.
      5. If the speech is already in the target language of the previous turn, do not repeat it.`;
    } else {
      return `You are a helpful AI friend named Camilla participating in a video call. 
      You are a native speaker of ${pLang.name}. 
      The user speaks ${mLang.name}.
      
      Instructions:
      1. When the user speaks to you in ${mLang.name}, understand them perfectly.
      2. ALWAYS reply in ${pLang.name}.
      3. Keep your answers relatively concise, as in a real video chat. 
      4. Be friendly, expressive, and engaging.`;
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
                       {!userStream && !error && <div className="absolute bottom-1/3 text-gray-400 text-sm animate-pulse">Initializing camera...</div>}
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
                    <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl flex flex-col gap-3 text-sm w-full max-w-sm">
                        <div className="flex items-start gap-2">
                             <AlertCircle size={18} className="shrink-0 mt-0.5" />
                             <span className="leading-snug">{error}</span>
                        </div>
                        <button 
                            onClick={requestMedia}
                            className="self-start bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors"
                        >
                            <RefreshCw size={14} /> Try Again
                        </button>
                    </div>
                )}

                <div className="flex gap-4">
                    <button 
                        onClick={startCall}
                        disabled={!userStream && !error} // Allow retrying if error via Join button too in some cases, but main retry is above
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