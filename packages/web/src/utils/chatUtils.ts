import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { Chat, Message } from '../store/chatStore';

export function getChatName(chat: Chat, currentUserId: string): string {
  if (chat.type === 'PRIVATE') {
    const other = chat.members?.find((m) => m.user.id !== currentUserId);
    return other?.user.displayName || 'Unknown';
  }
  return chat.name || 'Group';
}

export function getChatAvatar(chat: Chat, currentUserId: string): string | undefined {
  if (chat.type === 'PRIVATE') {
    const other = chat.members?.find((m) => m.user.id !== currentUserId);
    return other?.user.avatarUrl;
  }
  return chat.avatarUrl;
}

export function getLastMessagePreview(message: Message | undefined, currentUserId: string): string {
  if (!message) return '';
  const isOwn = message.senderId === currentUserId;
  const prefix = isOwn ? 'You: ' : '';

  switch (message.type) {
    case 'TEXT': return prefix + (message.content?.substring(0, 60) || '');
    case 'IMAGE': return prefix + '📷 Photo';
    case 'VIDEO': return prefix + '🎬 Video';
    case 'VIDEO_NOTE': return prefix + '📹 Video message';
    case 'VOICE': return prefix + '🎤 Voice message';
    case 'AUDIO': return prefix + '🎵 Audio';
    case 'FILE': return prefix + '📎 File';
    case 'STICKER': return prefix + '😀 Sticker';
    case 'GIF': return prefix + 'GIF';
    case 'LOCATION': return prefix + '📍 Location';
    case 'SYSTEM': return '🚫 Message deleted';
    default: return prefix + 'Message';
  }
}

export function getUnreadCount(chat: Chat): number {
  // This would be computed from lastReadMessageId vs actual messages
  // For now return 0 - would be enhanced with proper unread tracking
  return 0;
}

export function formatChatTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  if (differenceInDays(new Date(), date) < 7) return format(date, 'EEE');
  return format(date, 'dd/MM/yy');
}

export function formatMessageTime(dateStr: string): string {
  return format(new Date(dateStr), 'HH:mm');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function groupMessagesByDate(messages: Message[]) {
  const groups: { date: Date; messages: Message[] }[] = [];
  let currentGroup: { date: Date; messages: Message[] } | null = null;

  messages.forEach((msg) => {
    const msgDate = new Date(msg.sentAt);
    const dayStr = format(msgDate, 'yyyy-MM-dd');

    if (!currentGroup || format(currentGroup.date, 'yyyy-MM-dd') !== dayStr) {
      currentGroup = { date: msgDate, messages: [] };
      groups.push(currentGroup);
    }
    currentGroup.messages.push(msg);
  });

  return groups;
}

export function formatDateDivider(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}
