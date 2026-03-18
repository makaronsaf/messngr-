import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { api } from '../utils/api';
import { socketService } from '../utils/socket';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: string;
  content?: string;
  iv?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaSize?: number;
  mediaDuration?: number;
  mediaThumbnail?: string;
  mediaWidth?: number;
  mediaHeight?: number;
  waveform?: number[];
  replyToMessageId?: string;
  replyToMessage?: any;
  forwardedFromChatId?: string;
  forwardedFromMessageId?: string;
  selfDestructAt?: string;
  selfDestructAfterRead?: boolean;
  selfDestructSeconds?: number;
  isEdited?: boolean;
  editedAt?: string;
  isPinned?: boolean;
  sentAt: string;
  sender: { id: string; username: string; displayName: string; avatarUrl?: string };
  reactions: Array<{ id: string; emoji: string; userId: string }>;
  readBy: Array<{ userId: string; readAt: string }>;
  tempId?: string;
  isOptimistic?: boolean;
}

export interface Chat {
  id: string;
  type: 'PRIVATE' | 'GROUP' | 'CHANNEL';
  name?: string;
  description?: string;
  avatarUrl?: string;
  username?: string;
  isPublic?: boolean;
  isVerified?: boolean;
  encryptionEnabled?: boolean;
  members: Array<{
    id: string;
    role: string;
    isMuted: boolean;
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl?: string;
      status: string;
      lastSeen?: string;
    };
  }>;
  membership?: {
    role: string;
    isMuted: boolean;
    isPinned: boolean;
    lastReadMessageId?: string;
  };
  lastMessage?: Message;
  pinnedMessages?: any[];
}

interface TypingUser {
  userId: string;
  displayName: string;
}

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, TypingUser[]>;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  hasMoreMessages: Record<string, boolean>;
  replyingTo: Message | null;

  // Actions
  loadChats: () => Promise<void>;
  selectChat: (chatId: string) => Promise<void>;
  loadMessages: (chatId: string, before?: string) => Promise<void>;
  sendMessage: (chatId: string, data: Partial<Message> & { tempId?: string }) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string, forAll?: boolean) => void;
  addReaction: (messageId: string, emoji: string) => void;
  setTyping: (chatId: string, isTyping: boolean) => void;
  setReplyingTo: (message: Message | null) => void;
  createPrivateChat: (userId: string) => Promise<Chat>;
  createGroupChat: (data: any) => Promise<Chat>;

  // Socket events
  onNewMessage: (message: Message & { tempId?: string }) => void;
  onMessageEdited: (message: any) => void;
  onMessageDeleted: (data: { messageId: string; forAll: boolean }) => void;
  onReactionAdded: (data: any) => void;
  onReactionRemoved: (data: any) => void;
  onTypingUpdate: (data: { chatId: string; userId: string; displayName: string; isTyping: boolean }) => void;
  onReadReceipt: (data: { messageId: string; userId: string; readAt: string }) => void;
}

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    chats: [],
    activeChat: null,
    messages: {},
    typingUsers: {},
    isLoadingChats: false,
    isLoadingMessages: false,
    hasMoreMessages: {},
    replyingTo: null,

    loadChats: async () => {
      set((s) => { s.isLoadingChats = true; });
      try {
        const res = await api.get('/chats');
        set((s) => {
          s.chats = res.data.chats;
          s.isLoadingChats = false;
        });
      } catch {
        set((s) => { s.isLoadingChats = false; });
      }
    },

    selectChat: async (chatId) => {
      const existing = get().chats.find((c) => c.id === chatId);
      if (existing) {
        set((s) => { s.activeChat = existing; });
      }

      const res = await api.get(`/chats/${chatId}`);
      set((s) => {
        s.activeChat = res.data.chat;
        // Update in chats list
        const idx = s.chats.findIndex((c) => c.id === chatId);
        if (idx !== -1) s.chats[idx] = { ...s.chats[idx], ...res.data.chat };
      });

      // Load messages
      await get().loadMessages(chatId);

      // Socket: join chat room
      socketService.emit('chat:join', { chatId });
    },

    loadMessages: async (chatId, before) => {
      set((s) => { s.isLoadingMessages = true; });
      try {
        const params: any = { limit: 50 };
        if (before) params.before = before;

        const res = await api.get(`/messages/chat/${chatId}`, { params });
        const newMessages: Message[] = res.data.messages;

        set((s) => {
          if (before) {
            s.messages[chatId] = [...newMessages, ...(s.messages[chatId] || [])];
          } else {
            s.messages[chatId] = newMessages;
          }
          s.hasMoreMessages[chatId] = newMessages.length === 50;
          s.isLoadingMessages = false;
        });
      } catch {
        set((s) => { s.isLoadingMessages = false; });
      }
    },

    sendMessage: (chatId, data) => {
      // Optimistic update
      const tempId = data.tempId || `temp_${Date.now()}`;
      const optimisticMsg: Message = {
        id: tempId,
        chatId,
        senderId: data.senderId || '',
        type: data.type || 'TEXT',
        content: data.content,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        mediaSize: data.mediaSize,
        mediaDuration: data.mediaDuration,
        mediaThumbnail: data.mediaThumbnail,
        waveform: data.waveform,
        replyToMessageId: data.replyToMessageId,
        replyToMessage: data.replyToMessage,
        sentAt: new Date().toISOString(),
        sender: data.sender as any,
        reactions: [],
        readBy: [],
        isOptimistic: true,
        tempId,
      };

      set((s) => {
        if (!s.messages[chatId]) s.messages[chatId] = [];
        s.messages[chatId].push(optimisticMsg);
      });

      // Send via socket
      socketService.emit('message:send', { chatId, ...data, tempId });
    },

    editMessage: (messageId, content) => {
      socketService.emit('message:edit', { messageId, content });
    },

    deleteMessage: (messageId, forAll = false) => {
      socketService.emit('message:delete', { messageId, forAll });
    },

    addReaction: (messageId, emoji) => {
      socketService.emit('message:react', { messageId, emoji });
    },

    setTyping: (chatId, isTyping) => {
      socketService.emit(isTyping ? 'typing:start' : 'typing:stop', { chatId });
    },

    setReplyingTo: (message) => {
      set((s) => { s.replyingTo = message; });
    },

    createPrivateChat: async (userId) => {
      const res = await api.post('/chats/private', { userId });
      const chat = res.data.chat;
      set((s) => {
        const exists = s.chats.find((c) => c.id === chat.id);
        if (!exists) s.chats.unshift(chat);
      });
      return chat;
    },

    createGroupChat: async (data) => {
      const res = await api.post('/chats/group', data);
      const chat = res.data.chat;
      set((s) => { s.chats.unshift(chat); });
      return chat;
    },

    // Socket event handlers
    onNewMessage: (message) => {
      set((s) => {
        const chatMessages = s.messages[message.chatId] || [];

        // Remove optimistic version
        if (message.tempId) {
          const idx = chatMessages.findIndex((m) => m.id === message.tempId || m.tempId === message.tempId);
          if (idx !== -1) chatMessages.splice(idx, 1);
        }

        // Add real message
        const exists = chatMessages.find((m) => m.id === message.id);
        if (!exists) {
          chatMessages.push({ ...message, isOptimistic: false });
        }
        s.messages[message.chatId] = chatMessages;

        // Update last message in chats list
        const chatIdx = s.chats.findIndex((c) => c.id === message.chatId);
        if (chatIdx !== -1) {
          s.chats[chatIdx].lastMessage = message;
          // Move to top
          const [chat] = s.chats.splice(chatIdx, 1);
          s.chats.unshift(chat);
        }
      });
    },

    onMessageEdited: (message) => {
      set((s) => {
        const msgs = s.messages[message.chatId];
        if (msgs) {
          const idx = msgs.findIndex((m) => m.id === message.id);
          if (idx !== -1) msgs[idx] = { ...msgs[idx], ...message };
        }
      });
    },

    onMessageDeleted: ({ messageId, forAll }) => {
      set((s) => {
        for (const chatId in s.messages) {
          const msgs = s.messages[chatId];
          const idx = msgs.findIndex((m) => m.id === messageId);
          if (idx !== -1) {
            if (forAll) {
              msgs[idx] = { ...msgs[idx], content: undefined, mediaUrl: undefined, type: 'SYSTEM' };
            } else {
              msgs.splice(idx, 1);
            }
            break;
          }
        }
      });
    },

    onReactionAdded: ({ messageId, reaction }) => {
      set((s) => {
        for (const chatId in s.messages) {
          const msg = s.messages[chatId].find((m) => m.id === messageId);
          if (msg) {
            const exists = msg.reactions.find((r) => r.id === reaction.id);
            if (!exists) msg.reactions.push(reaction);
            break;
          }
        }
      });
    },

    onReactionRemoved: ({ messageId, userId, emoji }) => {
      set((s) => {
        for (const chatId in s.messages) {
          const msg = s.messages[chatId].find((m) => m.id === messageId);
          if (msg) {
            msg.reactions = msg.reactions.filter((r) => !(r.userId === userId && r.emoji === emoji));
            break;
          }
        }
      });
    },

    onTypingUpdate: ({ chatId, userId, displayName, isTyping }) => {
      set((s) => {
        if (!s.typingUsers[chatId]) s.typingUsers[chatId] = [];
        if (isTyping) {
          const exists = s.typingUsers[chatId].find((t) => t.userId === userId);
          if (!exists) s.typingUsers[chatId].push({ userId, displayName });
        } else {
          s.typingUsers[chatId] = s.typingUsers[chatId].filter((t) => t.userId !== userId);
        }
      });
    },

    onReadReceipt: ({ messageId, userId, readAt }) => {
      set((s) => {
        for (const chatId in s.messages) {
          const msg = s.messages[chatId].find((m) => m.id === messageId);
          if (msg) {
            const exists = msg.readBy.find((r) => r.userId === userId);
            if (!exists) msg.readBy.push({ userId, readAt });
            break;
          }
        }
      });
    },
  }))
);
