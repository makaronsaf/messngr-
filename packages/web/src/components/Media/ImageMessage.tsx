import { useState } from 'react';

interface ImageMessageProps {
  src: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

export function ImageMessage({ src, thumbnail, width, height }: ImageMessageProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const aspectRatio = width && height ? width / height : 4 / 3;
  const displayWidth = Math.min(280, width || 280);
  const displayHeight = displayWidth / aspectRatio;

  return (
    <>
      <div
        className="relative cursor-pointer rounded-lg overflow-hidden"
        style={{ width: displayWidth, height: Math.min(displayHeight, 320) }}
        onClick={() => setFullscreen(true)}
      >
        {thumbnail && !loaded && (
          <img src={thumbnail} className="absolute inset-0 w-full h-full object-cover blur-sm" alt="" />
        )}
        <img
          src={src}
          alt="Image"
          className="w-full h-full object-cover"
          onLoad={() => setLoaded(true)}
          loading="lazy"
        />
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreen(false)}
        >
          <img
            src={src}
            alt="Full"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-4xl leading-none"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
