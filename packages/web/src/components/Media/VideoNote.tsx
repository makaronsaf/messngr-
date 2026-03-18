import { useState, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatDuration } from '../../utils/chatUtils';

interface VideoNoteProps {
  src: string;
  duration?: number;
  thumbnail?: string;
}

export function VideoNote({ src, duration, thumbnail }: VideoNoteProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const SIZE = 200;
  const progress = duration && currentTime ? (currentTime / duration) * 360 : 0;

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      await video.play();
      setIsPlaying(true);
    }
  };

  const strokeWidth = 3;
  const radius = SIZE / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progress / 360) * circumference;

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{ width: SIZE, height: SIZE }}
      onClick={togglePlay}
    >
      {/* Progress ring */}
      <svg
        className="absolute inset-0 -rotate-90"
        width={SIZE}
        height={SIZE}
        style={{ zIndex: 2 }}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          stroke="#2AABEE"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="transition-all duration-100"
        />
      </svg>

      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        poster={thumbnail}
        className="rounded-full object-cover"
        style={{ width: SIZE, height: SIZE }}
        playsInline
        loop
        onLoadedMetadata={() => setIsLoaded(true)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
      />

      {/* Play/pause overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 z-10">
          <Play className="w-10 h-10 text-white ml-1" />
        </div>
      )}

      {/* Duration */}
      {duration && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center z-10">
          <span className="bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">
            {isPlaying ? formatDuration(Math.floor(currentTime)) : formatDuration(duration)}
          </span>
        </div>
      )}
    </div>
  );
}
