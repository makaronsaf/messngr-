import { Pin, X } from 'lucide-react';
import { useState } from 'react';

interface PinnedMessage {
  message: {
    id: string;
    content?: string;
    type: string;
    mediaUrl?: string;
    sender: { displayName: string };
  };
}

interface PinnedMessageBannerProps {
  pinnedMessages: PinnedMessage[];
  onScrollTo: (messageId: string) => void;
}

export function PinnedMessageBanner({ pinnedMessages, onScrollTo }: PinnedMessageBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  if (!pinnedMessages.length || dismissed) return null;

  const current = pinnedMessages[currentIdx];
  const msg = current.message;

  const preview = msg.type === 'TEXT'
    ? (msg.content || '').substring(0, 80)
    : msg.type === 'IMAGE' ? '📷 Фото'
    : msg.type === 'VIDEO' ? '🎬 Видео'
    : msg.type === 'VOICE' ? '🎤 Голосовое сообщение'
    : msg.type === 'FILE'  ? '📎 Файл'
    : msg.type === 'POLL'  ? '📊 Опрос'
    : `[${msg.type}]`;

  const handleClick = () => {
    onScrollTo(msg.id);
    // Cycle through pinned messages if multiple
    if (pinnedMessages.length > 1) {
      setCurrentIdx((prev) => (prev + 1) % pinnedMessages.length);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-tg-divider dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer group"
      onClick={handleClick}
    >
      <Pin className="w-3.5 h-3.5 text-tg-blue flex-shrink-0 rotate-45" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-tg-blue">
            Закреплённое сообщение{pinnedMessages.length > 1 ? ` ${currentIdx + 1}/${pinnedMessages.length}` : ''}
          </span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{preview}</p>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3.5 h-3.5 text-gray-400" />
      </button>
    </div>
  );
}
