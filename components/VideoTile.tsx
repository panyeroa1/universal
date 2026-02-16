import React from 'react';
import { MicOff } from 'lucide-react';

interface VideoTileProps {
  stream?: MediaStream | null;
  isSelf?: boolean;
  name: string;
  isMuted?: boolean;
  isSpeaking?: boolean;
  poster?: string;
}

export const VideoTile: React.FC<VideoTileProps> = ({ 
  stream, 
  isSelf, 
  name, 
  isMuted, 
  isSpeaking, 
  poster 
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative w-full h-full bg-[#3c4043] rounded-xl overflow-hidden group border-2 transition-colors duration-200 ${isSpeaking ? 'border-blue-500' : 'border-transparent'}`}>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isSelf} // Always mute self to prevent echo
          playsInline
          className={`w-full h-full object-cover ${isSelf ? '-scale-x-100' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
             {poster ? (
                 <img src={poster} alt={name} className="w-full h-full object-cover opacity-80" />
             ) : (
                <div className="w-32 h-32 rounded-full bg-orange-500 flex items-center justify-center text-4xl font-semibold text-white">
                    {name.charAt(0)}
                </div>
             )}
        </div>
      )}

      {/* Name Label */}
      <div className="absolute bottom-4 left-4 text-white text-sm font-medium bg-black/40 px-2 py-1 rounded select-none flex items-center gap-2">
        {name} {isSelf && "(You)"}
        {isMuted && <MicOff size={14} className="text-red-400" />}
      </div>
      
      {/* Speaking Indicator for non-video tiles */}
      {isSpeaking && !stream && (
        <div className="absolute top-4 right-4 bg-blue-500 p-1.5 rounded-full animate-pulse">
           <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
      )}
    </div>
  );
};