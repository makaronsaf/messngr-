import { format, isToday, isYesterday } from 'date-fns';
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
    case 'FILE': return prefix + '📎 File';
    default: return prefix + 'Message';
  }
}

export function formatChatTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd/MM/yy');
}

export function formatMessageTime(dateStr: string): string {
  return format(new Date(dateStr), 'HH:mm');
}

export function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
