import { useEffect } from 'react';
import { socketService } from '../utils/socket';
import { useChatStore } from '../store/chatStore';

export function useSocketEvents() {
  const { onNewMessage, onMessageEdited, onMessageDeleted, onTypingUpdate } = useChatStore();

  useEffect(() => {
    const handlers = {
      'message:new': (msg: any) => onNewMessage(msg),
      'message:edited': (msg: any) => onMessageEdited(msg),
      'message:deleted': (data: any) => onMessageDeleted(data),
      'typing:update': (data: any) => onTypingUpdate(data),
    };

    Object.entries(handlers).forEach(([event, handler]) => socketService.on(event, handler));
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => socketService.off(event, handler));
    };
  }, []);
}
