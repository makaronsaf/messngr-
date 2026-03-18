import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { socketService } from '../utils/socket';

export interface ActiveCall {
  callId: string;
  chatId: string;
  type: 'AUDIO' | 'VIDEO';
  status: 'ringing' | 'active' | 'ended';
  callerId?: string;
  callerName?: string;
  isIncoming: boolean;
  peerConnection?: RTCPeerConnection;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  isMuted: boolean;
  isVideoOn: boolean;
  participants: string[];
}

interface CallState {
  activeCall: ActiveCall | null;
  incomingCall: {
    callId: string;
    chatId: string;
    type: 'AUDIO' | 'VIDEO';
    callerId: string;
    callerName: string;
    offer: RTCSessionDescriptionInit;
  } | null;

  initiateCall: (chatId: string, type: 'AUDIO' | 'VIDEO') => Promise<void>;
  answerCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  setIncomingCall: (data: any) => void;
  setRemoteStream: (stream: MediaStream) => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export const useCallStore = create<CallState>()(
  immer((set, get) => ({
    activeCall: null,
    incomingCall: null,

    initiateCall: async (chatId, type) => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'VIDEO',
        });

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

        const remoteStream = new MediaStream();
        pc.ontrack = (e) => {
          e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
          get().setRemoteStream(remoteStream);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        pc.onicecandidate = ({ candidate }) => {
          if (candidate && get().activeCall?.callId) {
            socketService.emit('call:ice_candidate', {
              callId: get().activeCall!.callId,
              candidate,
            });
          }
        };

        set((s) => {
          s.activeCall = {
            callId: '',
            chatId,
            type,
            status: 'ringing',
            isIncoming: false,
            peerConnection: pc as any,
            localStream: localStream as any,
            remoteStream: remoteStream as any,
            isMuted: false,
            isVideoOn: type === 'VIDEO',
            participants: [],
          };
        });

        socketService.emit('call:initiate', { chatId, type, offer }, (res: any) => {
          if (res.callId) {
            set((s) => {
              if (s.activeCall) s.activeCall.callId = res.callId;
            });
          }
        });

      } catch (err) {
        console.error('Failed to initiate call:', err);
      }
    },

    answerCall: async () => {
      const incoming = get().incomingCall;
      if (!incoming) return;

      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: incoming.type === 'VIDEO',
        });

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

        const remoteStream = new MediaStream();
        pc.ontrack = (e) => {
          e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
          get().setRemoteStream(remoteStream);
        };

        await pc.setRemoteDescription(new RTCSessionDescription(incoming.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        pc.onicecandidate = ({ candidate }) => {
          if (candidate) {
            socketService.emit('call:ice_candidate', {
              callId: incoming.callId,
              candidate,
              targetUserId: incoming.callerId,
            });
          }
        };

        set((s) => {
          s.activeCall = {
            callId: incoming.callId,
            chatId: incoming.chatId,
            type: incoming.type,
            status: 'active',
            isIncoming: true,
            callerId: incoming.callerId,
            callerName: incoming.callerName,
            peerConnection: pc as any,
            localStream: localStream as any,
            remoteStream: remoteStream as any,
            isMuted: false,
            isVideoOn: incoming.type === 'VIDEO',
            participants: [incoming.callerId],
          };
          s.incomingCall = null;
        });

        socketService.emit('call:answer', { callId: incoming.callId, answer });

      } catch (err) {
        console.error('Failed to answer call:', err);
      }
    },

    declineCall: () => {
      const incoming = get().incomingCall;
      if (incoming) {
        socketService.emit('call:decline', { callId: incoming.callId });
      }
      set((s) => { s.incomingCall = null; });
    },

    endCall: () => {
      const call = get().activeCall;
      if (call) {
        socketService.emit('call:end', { callId: call.callId });
        (call.localStream as any)?.getTracks().forEach((t: any) => t.stop());
        (call.peerConnection as any)?.close();
      }
      set((s) => {
        s.activeCall = null;
        s.incomingCall = null;
      });
    },

    toggleMute: () => {
      const call = get().activeCall;
      if (!call) return;
      const newMuted = !call.isMuted;
      (call.localStream as any)?.getAudioTracks().forEach((t: any) => { t.enabled = !newMuted; });
      set((s) => { if (s.activeCall) s.activeCall.isMuted = newMuted; });
      socketService.emit('call:toggle_media', {
        callId: call.callId,
        isMuted: newMuted,
        isVideoOn: call.isVideoOn,
      });
    },

    toggleVideo: () => {
      const call = get().activeCall;
      if (!call) return;
      const newVideoOn = !call.isVideoOn;
      (call.localStream as any)?.getVideoTracks().forEach((t: any) => { t.enabled = newVideoOn; });
      set((s) => { if (s.activeCall) s.activeCall.isVideoOn = newVideoOn; });
      socketService.emit('call:toggle_media', {
        callId: call.callId,
        isMuted: call.isMuted,
        isVideoOn: newVideoOn,
      });
    },

    setIncomingCall: (data) => {
      set((s) => { s.incomingCall = data; });
    },

    setRemoteStream: (stream) => {
      set((s) => {
        if (s.activeCall) s.activeCall.remoteStream = stream as any;
      });
    },
  }))
);
