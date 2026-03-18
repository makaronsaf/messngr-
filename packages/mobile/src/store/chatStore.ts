import { create } from 'zustand';
import { api } from '../utils/api';
import { socketService } from '../utils/socket';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaSize?: number;
  mediaDuration?: number;
  mediaThumbnail?: string;
  waveform?: number[];
  replyToMessageId?: string;
  replyToMessage?: any;
  isEdited?: boolean;
  sentAt: string;
  sender: { id: string; username: string; displayName: string; avatarUrl?: string };
  reactions: Array<{ id: string; emoji: string; userId: string }>;
  readBy: Array<{ userId: string; readAt: string }>;
  isOptimistic?: boolean;
  tempId?: string;
}

export interface Chat {
  id: string;
  type: 'PRIVATE' | 'GROUP' | 'CHANNEL';
  name?: string;
  avatarUrl?: string;
  members: Array<{
    id: string;
    role: string;
    user: { id: string; username: string; displayName: string; avatarUrl?: string; status: string; lastSeen?: string };
  }>;
  lastMessage?: Message;
}

interface ChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
  typingUsers: Record<string, Array<{ userId: string; displayName: string }>>;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  replyingTo: Message | null;

  loadChats: () => Promise<void>;
  selectChat: (chatId: string) => Promise<void>;
  loadMessages: (chatId: string, before?: string) => Promise<void>;
  sendMessage: (chatId: string, data: any) => void;
  setReplyingTo: (message: Message | null) => void;

  onNewMessage: (message: Message & { tempId?: string }) => void;
  onMessageEdited: (message: any) => void;
  onMessageDeleted: (data: { messageId: string; forAll: boolean }) => void;
  onTypingUpdate: (data: { chatId: string; userId: string; displayName: string; isTyping: boolean }) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  messages: {},
  typingUsers: {},
  isLoadingChats: false,
  isLoadingMessages: false,
  replyingTo: null,

  loadChats: async () => {
    set({ isLoadingChats: true });
    try {
      const res = await api.get('/chats');
      set({ chats: res.data.chats, isLoadingChats: false });
    } catch {
      set({ isLoadingChats: false });
    }
  },

  selectChat: async (chatId) => {
    await get().loadMessages(chatId);
    socketService.emit('chat:join', { chatId });
  },

  loadMessages: async (chatId, before) => {
    set({ isLoadingMessages: true });
    try {
      const res = await api.get(`/messages/chat/${chatId}`, { params: { limit: 50, before } });
      const msgs: Message[] = res.data.messages;
      set((s) => ({
        messages: {
          ...s.messages,
          [chatId]: before ? [...msgs, ...(s.messages[chatId] || [])] : msgs,
        },
        isLoadingMessages: false,
      }));
    } catch {
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: (chatId, data) => {
    const tempId = `temp_${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      chatId,
      senderId: data.senderId,
      type: data.type || 'TEXT',
      content: data.content,
      mediaUrl: data.mediaUrl,
      mediaDuration: data.mediaDuration,
      waveform: data.waveform,
      sentAt: new Date().toISOString(),
      sender: data.sender,
      reactions: [],
      readBy: [],
      isOptimistic: true,
      tempId,
    };

    set((s) => ({
      messages: {
        ...s.messages,
        [chatId]: [...(s.messages[chatId] || []), optimistic],
      },
    }));

    socketService.emit('message:send', { chatId, ...data, tempId });
  },

  setReplyingTo: (message) => set({ replyingTo: message }),

  onNewMessage: (message) => {
    set((s) => {
      const msgs = [...(s.messages[message.chatId] || [])];
      if (message.tempId) {
        const idx = msgs.findIndex((m) => m.id === message.tempId || m.tempId === message.tempId);
        if (idx !== -1) msgs.splice(idx, 1);
      }
      if (!msgs.find((m) => m.id === message.id)) msgs.push({ ...message, isOptimistic: false });

      const chats = s.chats.map((c) => c.id === message.chatId ? { ...c, lastMessage: message } : c);
      const idx = chats.findIndex((c) => c.id === message.chatId);
      if (idx > 0) { const [chat] = chats.splice(idx, 1); chats.unshift(chat); }

      return { messages: { ...s.messages, [message.chatId]: msgs }, chats };
    });
  },

  onMessageEdited: (message) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [message.chatId]: (s.messages[message.chatId] || []).map((m) =>
          m.id === message.id ? { ...m, ...message } : m
        ),
      },
    }));
  },

  onMessageDeleted: ({ messageId, forAll }) => {
    set((s) => {
      const newMessages = { ...s.messages };
      for (const chatId in newMessages) {
        const idx = newMessages[chatId].findIndex((m) => m.id === messageId);
        if (idx !== -1) {
          newMessages[chatId] = [...newMessages[chatId]];
          if (forAll) {
            newMessages[chatId][idx] = { ...newMessages[chatId][idx], content: undefined, type: 'SYSTEM' };
          } else {
            newMessages[chatId].splice(idx, 1);
          }
          break;
        }
      }
      return { messages: newMessages };
    });
  },

  onTypingUpdate: ({ chatId, userId, displayName, isTyping }) => {
    set((s) => {
      const users = s.typingUsers[chatId] || [];
      const updated = isTyping
        ? users.find((u) => u.userId === userId) ? users : [...users, { userId, displayName }]
        : users.filter((u) => u.userId !== userId);
      return { typingUsers: { ...s.typingUsers, [chatId]: updated } };
    });
  },
}));
