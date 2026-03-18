import { useEffect } from 'react';
import { socketService } from '../utils/socket';
import { useChatStore } from '../store/chatStore';
import { useCallStore } from '../store/callStore';

export function useSocketEvents() {
  const chatStore = useChatStore();
  const callStore = useCallStore();

  useEffect(() => {
    // Message events
    const onNewMessage = (message: any) => chatStore.onNewMessage(message);
    const onMessageEdited = (message: any) => chatStore.onMessageEdited(message);
    const onMessageDeleted = (data: any) => chatStore.onMessageDeleted(data);
    const onReactionAdded = (data: any) => chatStore.onReactionAdded(data);
    const onReactionRemoved = (data: any) => chatStore.onReactionRemoved(data);
    const onTypingUpdate = (data: any) => chatStore.onTypingUpdate(data);
    const onReadReceipt = (data: any) => chatStore.onReadReceipt(data);

    // Call events
    const onIncomingCall = (data: any) => callStore.setIncomingCall(data);
    const onCallAnswered = async (data: any) => {
      const call = callStore.activeCall;
      if (call?.peerConnection) {
        try {
          await (call.peerConnection as any).setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } catch (err) {
          console.error('Failed to set remote answer:', err);
        }
      }
    };
    const onCallDeclined = () => callStore.endCall();
    const onCallEnded = () => callStore.endCall();
    const onIceCandidate = async (data: any) => {
      const call = callStore.activeCall;
      if (call?.peerConnection) {
        try {
          await (call.peerConnection as any).addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch {}
      }
    };

    // Register all listeners
    socketService.on('message:new', onNewMessage);
    socketService.on('message:edited', onMessageEdited);
    socketService.on('message:deleted', onMessageDeleted);
    socketService.on('message:reaction_added', onReactionAdded);
    socketService.on('message:reaction_removed', onReactionRemoved);
    socketService.on('typing:update', onTypingUpdate);
    socketService.on('message:read_receipt', onReadReceipt);
    socketService.on('call:incoming', onIncomingCall);
    socketService.on('call:answered', onCallAnswered);
    socketService.on('call:declined', onCallDeclined);
    socketService.on('call:ended', onCallEnded);
    socketService.on('call:ice_candidate', onIceCandidate);

    return () => {
      socketService.off('message:new', onNewMessage);
      socketService.off('message:edited', onMessageEdited);
      socketService.off('message:deleted', onMessageDeleted);
      socketService.off('message:reaction_added', onReactionAdded);
      socketService.off('message:reaction_removed', onReactionRemoved);
      socketService.off('typing:update', onTypingUpdate);
      socketService.off('message:read_receipt', onReadReceipt);
      socketService.off('call:incoming', onIncomingCall);
      socketService.off('call:answered', onCallAnswered);
      socketService.off('call:declined', onCallDeclined);
      socketService.off('call:ended', onCallEnded);
      socketService.off('call:ice_candidate', onIceCandidate);
    };
  }, []);
}
