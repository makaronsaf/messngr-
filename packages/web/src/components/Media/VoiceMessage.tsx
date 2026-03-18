import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatDuration } from '../../utils/chatUtils';

interface VoiceMessageProps {
  src: string;
  duration: number;
  waveform?: number[];
  isOwn: boolean;
}

const DEFAULT_WAVEFORM = Array.from({ length: 30 }, () => Math.random() * 0.8 + 0.1);

export function VoiceMessage({ src, duration, waveform, isOwn }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const bars = waveform && waveform.length > 0 ? waveform : DEFAULT_WAVEFORM;
  const progress = duration > 0 ? currentTime / duration : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      await audio.play();
      setIsPlaying(true);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audio.currentTime = pct * duration;
  };

  return (
    <div className="flex items-center gap-3 min-w-[200px] max-w-[240px] py-1">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          isOwn
            ? 'bg-white/30 hover:bg-white/40 text-white'
            : 'bg-tg-blue/20 hover:bg-tg-blue/30 text-tg-blue'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        {/* Waveform */}
        <div
          className="flex items-center gap-0.5 h-8 cursor-pointer"
          onClick={handleWaveformClick}
        >
          {bars.map((amplitude, i) => {
            const played = i / bars.length < progress;
            return (
              <div
                key={i}
                className={`waveform-bar flex-1 transition-colors duration-100 ${
                  played
                    ? isOwn ? 'bg-white' : 'bg-tg-blue'
                    : isOwn ? 'bg-white/50' : 'bg-gray-300 dark:bg-gray-500'
                }`}
                style={{ height: `${amplitude * 100}%`, minHeight: 2, maxHeight: '100%' }}
              />
            );
          })}
        </div>

        {/* Duration */}
        <div className={`text-[10px] mt-0.5 ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
          {isPlaying ? formatDuration(Math.floor(currentTime)) : formatDuration(duration)}
        </div>
      </div>
    </div>
  );
}
