import { useState, useRef } from 'react';
import { Check, CheckCheck, Trash2, Edit3, Reply, Forward, Timer } from 'lucide-react';
import { Message, useChatStore } from '../../store/chatStore';
import { Avatar } from './Avatar';
import { VoiceMessage } from '../Media/VoiceMessage';
import { VideoNote } from '../Media/VideoNote';
import { FileMessage } from '../Media/FileMessage';
import { ImageMessage } from '../Media/ImageMessage';
import { VideoMessage } from '../Media/VideoMessage';
import { ReactionBar } from './ReactionBar';
import { EmojiPicker } from './EmojiPicker';
import { formatMessageTime, formatDuration } from '../../utils/chatUtils';
import { clsx } from 'clsx';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  showSenderName: boolean;
  currentUserId: string;
}

export function MessageBubble({ message, isOwn, showAvatar, showSenderName, currentUserId }: MessageBubbleProps) {
  const { addReaction, setReplyingTo, deleteMessage, editMessage } = useChatStore();
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowActions(true);
  };

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => setShowActions(true), 600);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const readCount = message.readBy?.filter((r) => r.userId !== currentUserId).length || 0;

  if (message.type === 'SYSTEM' || (message as any).isDeleted) {
    return (
      <div className="flex justify-center my-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-black/10 dark:bg-white/10 px-3 py-1 rounded-full">
          Message deleted
        </span>
      </div>
    );
  }

  return (
    <div
      className={clsx('flex items-end gap-1 mb-0.5 msg-appear group', {
        'justify-end': isOwn,
        'justify-start': !isOwn,
        'opacity-70': message.isOptimistic,
      })}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Avatar (for received messages) */}
      {!isOwn && (
        <div className="w-8 flex-shrink-0">
          {showAvatar && (
            <Avatar
              src={message.sender.avatarUrl}
              name={message.sender.displayName}
              size={32}
            />
          )}
        </div>
      )}

      <div className={clsx('max-w-[70%] flex flex-col', { 'items-end': isOwn, 'items-start': !isOwn })}>
        {/* Self-destruct indicator */}
        {message.selfDestructAt && (
          <div className="flex items-center gap-1 text-xs text-orange-500 mb-0.5">
            <Timer className="w-3 h-3" />
            <span>Self-destructs</span>
          </div>
        )}

        {/* Bubble */}
        <div
          className={clsx('msg-bubble relative', {
            'msg-bubble-out': isOwn,
            'msg-bubble-in': !isOwn,
          })}
        >
          {/* Sender name (groups) */}
          {showSenderName && !isOwn && (
            <div className="text-xs font-semibold text-tg-blue mb-1">
              {message.sender.displayName}
            </div>
          )}

          {/* Reply preview */}
          {message.replyToMessage && (
            <div className={clsx('border-l-2 pl-2 mb-2 text-xs rounded', {
              'border-tg-blue bg-tg-blue/10': isOwn,
              'border-gray-300 bg-gray-50 dark:bg-gray-700 dark:border-gray-500': !isOwn,
            })}>
              <div className="font-semibold text-tg-blue">
                {message.replyToMessage.sender?.displayName}
              </div>
              <div className="text-gray-500 truncate">
                {message.replyToMessage.content || `[${message.replyToMessage.type}]`}
              </div>
            </div>
          )}

          {/* Message content by type */}
          {message.type === 'TEXT' && (
            <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">
              {message.content}
              {message.isEdited && (
                <span className="text-[10px] text-gray-400 ml-1">(edited)</span>
              )}
            </p>
          )}

          {message.type === 'IMAGE' && (
            <ImageMessage src={message.mediaUrl!} thumbnail={message.mediaThumbnail} width={message.mediaWidth} height={message.mediaHeight} />
          )}

          {message.type === 'VIDEO' && (
            <VideoMessage src={message.mediaUrl!} thumbnail={message.mediaThumbnail} duration={message.mediaDuration} />
          )}

          {(message.type === 'VOICE' || message.type === 'AUDIO') && (
            <VoiceMessage
              src={message.mediaUrl!}
              duration={message.mediaDuration || 0}
              waveform={message.waveform}
              isOwn={isOwn}
            />
          )}

          {message.type === 'VIDEO_NOTE' && (
            <VideoNote src={message.mediaUrl!} duration={message.mediaDuration} />
          )}

          {message.type === 'FILE' && (
            <FileMessage
              url={message.mediaUrl!}
              name={message.mediaType || 'File'}
              size={message.mediaSize}
            />
          )}

          {/* Time and read status */}
          <div className="msg-time">
            <span>{formatMessageTime(message.sentAt)}</span>
            {isOwn && (
              <span className="text-tg-blue/70">
                {readCount > 0 ? <CheckCheck className="w-3.5 h-3.5 inline" /> : <Check className="w-3.5 h-3.5 inline" />}
              </span>
            )}
          </div>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <ReactionBar
            reactions={message.reactions}
            currentUserId={currentUserId}
            onReact={(emoji) => addReaction(message.id, emoji)}
            isOwn={isOwn}
          />
        )}
      </div>

      {/* Quick emoji reaction (hover) */}
      <button
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 self-center"
        title="React"
      >
        <span className="text-base">😊</span>
      </button>

      {/* Context menu */}
      {showActions && (
        <MessageActions
          message={message}
          isOwn={isOwn}
          onClose={() => setShowActions(false)}
          onReply={() => { setReplyingTo(message); setShowActions(false); }}
          onDelete={(forAll) => { deleteMessage(message.id, forAll); setShowActions(false); }}
          onEdit={() => setShowActions(false)}
          onReact={() => { setShowEmojiPicker(true); setShowActions(false); }}
        />
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => { addReaction(message.id, emoji); setShowEmojiPicker(false); }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
}

function MessageActions({ message, isOwn, onClose, onReply, onDelete, onEdit, onReact }: any) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute z-50 bg-white dark:bg-gray-800 rounded-xl shadow-modal border border-gray-100 dark:border-gray-700 py-1 min-w-[160px]"
        style={{ top: '50%', ...(isOwn ? { right: '100%', marginRight: 8 } : { left: '100%', marginLeft: 8 }) }}
      >
        {/* Quick reactions */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
          {['👍', '❤️', '😂', '😮', '😢', '🔥'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onReact(); }}
              className="text-xl hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>

        <ActionItem icon={<Reply className="w-4 h-4" />} label="Reply" onClick={onReply} />
        <ActionItem icon={<Forward className="w-4 h-4" />} label="Forward" onClick={onClose} />
        {isOwn && message.type === 'TEXT' && (
          <ActionItem icon={<Edit3 className="w-4 h-4" />} label="Edit" onClick={onEdit} />
        )}
        <ActionItem
          icon={<Trash2 className="w-4 h-4 text-red-500" />}
          label={<span className="text-red-500">Delete</span>}
          onClick={() => onDelete(isOwn)}
        />
      </div>
    </>
  );
}

function ActionItem({ icon, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
    >
      <span className="text-gray-500 dark:text-gray-400">{icon}</span>
      {label}
    </button>
  );
}
