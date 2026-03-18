import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Video, Search, MoreVertical, Lock, Bookmark } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useCallStore } from '../../store/callStore';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Avatar } from './Avatar';
import { PinnedMessageBanner } from './PinnedMessageBanner';
import { getChatName, getChatAvatar } from '../../utils/chatUtils';
import { IncomingCallModal } from '../Calls/IncomingCallModal';

interface ChatWindowProps {
  onBack?: () => void;
}

export function ChatWindow({ onBack }: ChatWindowProps) {
  const { chatId } = useParams<{ chatId: string }>();
  const { activeChat, typingUsers, selectChat } = useChatStore();
  const { user } = useAuthStore();
  const { incomingCall, initiateCall } = useCallStore();

  useEffect(() => {
    if (chatId && chatId !== activeChat?.id) {
      selectChat(chatId);
    }
  }, [chatId]);

  if (!activeChat || !user) {
    return (
      <div className="h-full flex items-center justify-center bg-tg-chat-bg">
        <div className="w-8 h-8 border-2 border-tg-blue/30 border-t-tg-blue rounded-full animate-spin" />
      </div>
    );
  }

  const chatName = getChatName(activeChat, user.id);
  const chatAvatar = getChatAvatar(activeChat, user.id);
  const typing = typingUsers[activeChat.id] || [];

  const otherMember = activeChat.type === 'PRIVATE'
    ? activeChat.members?.find((m) => m.user.id !== user.id)
    : null;

  const statusText = typing.length > 0
    ? `${typing.map((t) => t.displayName).join(', ')} ${typing.length === 1 ? 'is' : 'are'} typing...`
    : otherMember?.user.status === 'ONLINE'
    ? 'online'
    : otherMember?.user.lastSeen
    ? `last seen ${new Date(otherMember.user.lastSeen).toLocaleString()}`
    : activeChat.type !== 'PRIVATE'
    ? `${activeChat.members?.length || 0} members`
    : '';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="tg-header flex-shrink-0 gap-3 dark:bg-gray-900 dark:border-gray-700">
        <button
          onClick={onBack}
          className="md:hidden p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
          <Avatar src={chatAvatar} name={chatName} size={40} />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-gray-900 dark:text-white truncate">{chatName}</span>
              {activeChat.encryptionEnabled && (
                <Lock className="w-3.5 h-3.5 text-tg-green flex-shrink-0" />
              )}
            </div>
            <p className={`text-xs truncate ${typing.length > 0 ? 'text-tg-blue' : 'text-gray-500 dark:text-gray-400'}`}>
              {statusText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {(activeChat.type === 'PRIVATE' || activeChat.type === 'GROUP') && (
            <>
              <button
                onClick={() => initiateCall(activeChat.id, 'AUDIO')}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Audio call"
              >
                <Phone className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={() => initiateCall(activeChat.id, 'VIDEO')}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Video call"
              >
                <Video className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </>
          )}
          <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Search className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Pinned messages banner */}
      {activeChat.pinnedMessages && activeChat.pinnedMessages.length > 0 && (
        <PinnedMessageBanner
          pinnedMessages={activeChat.pinnedMessages}
          onScrollTo={(messageId) => {
            document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />
      )}

      {/* Saved Messages label */}
      {(activeChat as any).isSavedMessages && (
        <div className="flex items-center gap-2 px-4 py-2 bg-tg-blue/5 border-b border-tg-divider dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          <Bookmark className="w-3.5 h-3.5 text-tg-blue" />
          Your private space — save messages, links, and notes here
        </div>
      )}

      {/* Messages */}
      <MessageList chatId={activeChat.id} currentUserId={user.id} />

      {/* Input */}
      <MessageInput chatId={activeChat.id} />

      {/* Incoming call modal */}
      {incomingCall && <IncomingCallModal />}
    </div>
  );
}
