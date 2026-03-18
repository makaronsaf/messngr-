import { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface VideoMessageProps {
  src: string;
  thumbnail?: string;
  duration?: number;
}

export function VideoMessage({ src, thumbnail, duration }: VideoMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) { v.pause(); setIsPlaying(false); }
    else { v.play(); setIsPlaying(true); }
  };

  return (
    <div className="relative rounded-lg overflow-hidden cursor-pointer" style={{ maxWidth: 280, maxHeight: 320 }}>
      <video
        ref={videoRef}
        src={src}
        poster={thumbnail}
        className="w-full h-full object-cover"
        muted={isMuted}
        playsInline
        onEnded={() => setIsPlaying(false)}
      />

      {/* Controls overlay */}
      <div
        className="absolute inset-0 bg-black/20 flex items-center justify-center"
        onClick={togglePlay}
      >
        {!isPlaying && (
          <div className="w-14 h-14 bg-black/50 rounded-full flex items-center justify-center">
            <Play className="w-7 h-7 text-white ml-1" />
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {isPlaying && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 p-2 flex justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
            className="text-white p-1"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
