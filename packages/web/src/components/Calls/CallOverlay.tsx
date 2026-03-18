import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Minimize2 } from 'lucide-react';
import { useCallStore } from '../../store/callStore';

export function CallOverlay() {
  const { activeCall, endCall, toggleMute, toggleVideo } = useCallStore();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [minimized, setMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (activeCall?.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = activeCall.localStream as any;
    }
  }, [activeCall?.localStream]);

  useEffect(() => {
    if (activeCall?.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = activeCall.remoteStream as any;
    }
  }, [activeCall?.remoteStream]);

  useEffect(() => {
    if (activeCall?.status === 'active') {
      const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [activeCall?.status]);

  if (!activeCall) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (minimized) {
    return (
      <div
        className="fixed bottom-20 right-4 z-50 bg-tg-blue rounded-full p-3 shadow-lg cursor-pointer flex items-center gap-2"
        onClick={() => setMinimized(false)}
      >
        <Phone className="w-5 h-5 text-white" />
        {activeCall.status === 'active' && (
          <span className="text-white text-sm font-mono">{formatTime(callDuration)}</span>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Remote video / Audio call background */}
      {activeCall.type === 'VIDEO' ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-32 h-32 bg-tg-blue rounded-full flex items-center justify-center mx-auto mb-4 text-white text-4xl font-bold">
              {activeCall.callerName?.charAt(0) || '?'}
            </div>
            <h2 className="text-white text-xl font-semibold">{activeCall.callerName || 'Unknown'}</h2>
            <p className="text-gray-400 mt-1">
              {activeCall.status === 'ringing' ? 'Calling...' : formatTime(callDuration)}
            </p>
          </div>
        </div>
      )}

      {/* Local video (PiP) */}
      {activeCall.type === 'VIDEO' && activeCall.isVideoOn && (
        <div className="absolute top-4 right-4 w-32 h-44 rounded-xl overflow-hidden border-2 border-white/30 shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror"
          />
        </div>
      )}

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-safe-top pt-12">
        <button
          onClick={() => setMinimized(true)}
          className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30"
        >
          <Minimize2 className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="text-white/70 text-xs">
            {activeCall.type === 'AUDIO' ? 'Audio call' : 'Video call'}
          </p>
        </div>

        <div className="w-10" />
      </div>

      {/* Controls */}
      <div className="relative z-10 mt-auto pb-16 flex items-center justify-center gap-6">
        <CallButton
          icon={activeCall.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          label={activeCall.isMuted ? 'Unmute' : 'Mute'}
          onClick={toggleMute}
          active={activeCall.isMuted}
        />

        {activeCall.type === 'VIDEO' && (
          <CallButton
            icon={activeCall.isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            label={activeCall.isVideoOn ? 'Camera off' : 'Camera on'}
            onClick={toggleVideo}
            active={!activeCall.isVideoOn}
          />
        )}

        <button
          onClick={endCall}
          className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors shadow-lg"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}

function CallButton({ icon, label, onClick, active }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
        active ? 'bg-white text-gray-900' : 'bg-white/20 text-white hover:bg-white/30'
      }`}>
        {icon}
      </div>
      <span className="text-white/70 text-xs">{label}</span>
    </button>
  );
}
