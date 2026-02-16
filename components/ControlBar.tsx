import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Captions, Settings, Sparkles } from 'lucide-react';

interface ControlBarProps {
  isMuted: boolean;
  toggleMute: () => void;
  isCameraOn: boolean;
  toggleCamera: () => void;
  onEndCall: () => void;
  showTranslationPanel: boolean;
  toggleTranslationPanel: () => void;
  isConnecting: boolean;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isMuted,
  toggleMute,
  isCameraOn,
  toggleCamera,
  onEndCall,
  showTranslationPanel,
  toggleTranslationPanel,
  isConnecting
}) => {
  const buttonBaseClass = "p-3 rounded-full transition-all duration-200 flex items-center justify-center";
  const activeClass = "bg-[#3c4043] hover:bg-[#4d5155] text-white";
  const inactiveClass = "bg-[#ea4335] hover:bg-[#d93025] text-white";
  const toggleActiveClass = "bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]";

  return (
    <div className="h-20 bg-[#202124] flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex-1 text-white text-lg font-medium hidden md:block">
            {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} | Orbit Meeting
        </div>

        <div className="flex items-center gap-3">
            {/* Mic Toggle */}
            <button onClick={toggleMute} className={`${buttonBaseClass} ${isMuted ? inactiveClass : activeClass}`} title="Toggle Microphone">
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            {/* Camera Toggle */}
            <button onClick={toggleCamera} className={`${buttonBaseClass} ${!isCameraOn ? inactiveClass : activeClass}`} title="Toggle Camera">
                {!isCameraOn ? <VideoOff size={24} /> : <Video size={24} />}
            </button>

            {/* Captions / Translation Toggle */}
            <button 
                onClick={toggleTranslationPanel} 
                className={`${buttonBaseClass} ${showTranslationPanel ? toggleActiveClass : activeClass} relative`}
                title="Translation Settings"
            >
                <Sparkles size={24} />
            </button>
            
            <button onClick={() => {}} className={`${buttonBaseClass} ${activeClass} hidden sm:flex`} title="More options">
                <Settings size={24} />
            </button>

            {/* End Call */}
            <button onClick={onEndCall} className={`${buttonBaseClass} bg-[#ea4335] hover:bg-[#d93025] px-6 ml-2`} title="Leave Call">
                <PhoneOff size={24} fill="white" />
            </button>
        </div>

         <div className="flex-1 flex justify-end items-center gap-4 hidden md:flex text-[#e8eaed]">
            <button title="Information">
                 <Captions size={24} />
            </button>
            <button title="Chat">
                <MessageSquare size={24} />
            </button>
        </div>
    </div>
  );
};