import { useEffect, useRef, useCallback } from 'react';
import { useChatStore, Message } from '../../store/chatStore';
import { MessageBubble } from './MessageBubble';
import { formatDateDivider, groupMessagesByDate } from '../../utils/chatUtils';

interface MessageListProps {
  chatId: string;
  currentUserId: string;
}

export function MessageList({ chatId, currentUserId }: MessageListProps) {
  const { messages, isLoadingMessages, hasMoreMessages, loadMessages } = useChatStore();
  const chatMessages = messages[chatId] || [];
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  // Scroll to bottom on new messages
  useEffect(() => {
    const msgs = messages[chatId] || [];
    if (msgs.length > prevLengthRef.current) {
      const lastMsg = msgs[msgs.length - 1];
      // Only auto-scroll if it's a new message (not loading older ones)
      if (lastMsg && (!bottomRef.current || prevLengthRef.current === 0)) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else if (lastMsg?.senderId === currentUserId) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevLengthRef.current = msgs.length;
  }, [messages, chatId, currentUserId]);

  // Load older messages on scroll to top
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || isLoadingMessages || !hasMoreMessages[chatId]) return;

    if (container.scrollTop < 100) {
      const firstMsg = chatMessages[0];
      if (firstMsg) {
        loadMessages(chatId, firstMsg.sentAt);
      }
    }
  }, [chatId, isLoadingMessages, hasMoreMessages, chatMessages, loadMessages]);

  const groups = groupMessagesByDate(chatMessages);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
      style={{ backgroundImage: "url('/chat-bg.png')", backgroundRepeat: 'repeat' }}
    >
      {/* Load more indicator */}
      {isLoadingMessages && (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 border-2 border-tg-blue/30 border-t-tg-blue rounded-full animate-spin" />
        </div>
      )}

      {/* Messages grouped by date */}
      {groups.map(({ date, messages: dayMsgs }) => (
        <div key={date.toISOString()}>
          {/* Date divider */}
          <div className="flex justify-center my-3">
            <span className="bg-black/20 text-white text-xs px-3 py-1 rounded-full">
              {formatDateDivider(date)}
            </span>
          </div>

          {/* Messages */}
          {dayMsgs.map((message, idx) => {
            const prevMsg = idx > 0 ? dayMsgs[idx - 1] : null;
            const nextMsg = idx < dayMsgs.length - 1 ? dayMsgs[idx + 1] : null;
            const isOwn = message.senderId === currentUserId;
            const showAvatar = !isOwn && (!nextMsg || nextMsg.senderId !== message.senderId);
            const showSenderName = !isOwn && (!prevMsg || prevMsg.senderId !== message.senderId);

            return (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={isOwn}
                showAvatar={showAvatar}
                showSenderName={showSenderName}
                currentUserId={currentUserId}
              />
            );
          })}
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
