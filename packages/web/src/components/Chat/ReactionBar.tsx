import { clsx } from 'clsx';

interface Reaction {
  id: string;
  emoji: string;
  userId: string;
}

interface ReactionBarProps {
  reactions: Reaction[];
  currentUserId: string;
  onReact: (emoji: string) => void;
  isOwn: boolean;
}

export function ReactionBar({ reactions, currentUserId, onReact, isOwn }: ReactionBarProps) {
  // Group reactions by emoji
  const grouped = reactions.reduce((acc: Record<string, { count: number; hasOwn: boolean }>, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, hasOwn: false };
    acc[r.emoji].count++;
    if (r.userId === currentUserId) acc[r.emoji].hasOwn = true;
    return acc;
  }, {});

  if (Object.keys(grouped).length === 0) return null;

  return (
    <div className={clsx('flex flex-wrap gap-1 mt-1', { 'justify-end': isOwn })}>
      {Object.entries(grouped).map(([emoji, { count, hasOwn }]) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className={clsx(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all reaction-popup',
            hasOwn
              ? 'bg-tg-blue/20 border-tg-blue text-tg-blue'
              : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-tg-blue/50'
          )}
        >
          <span>{emoji}</span>
          {count > 1 && <span className="font-medium">{count}</span>}
        </button>
      ))}
    </div>
  );
}
