import { useState, useEffect } from 'react';
import { BarChart2, Lock, CheckCircle2, Circle } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

interface PollOption {
  id: string;
  text: string;
  order: number;
  votes: { userId?: string }[];
}

interface PollData {
  id: string;
  question: string;
  isMultiple: boolean;
  isAnonymous: boolean;
  isClosed: boolean;
  options: PollOption[];
  myVotes: string[];
  totalVoters?: number;
}

interface PollMessageProps {
  messageId: string;
  pollId?: string;
  question?: string;
  initialPoll?: PollData | null;
  isOwn: boolean;
}

export function PollMessage({ messageId, pollId, question, initialPoll, isOwn }: PollMessageProps) {
  const { user } = useAuthStore();
  const [poll, setPoll] = useState<PollData | null>(initialPoll || null);
  const [selected, setSelected] = useState<string[]>(initialPoll?.myVotes || []);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState((initialPoll?.myVotes?.length || 0) > 0);

  useEffect(() => {
    if (!poll && pollId) {
      api.get(`/polls/${pollId}`).then((res) => {
        setPoll(res.data.poll);
        setSelected(res.data.poll.myVotes || []);
        setHasVoted((res.data.poll.myVotes?.length || 0) > 0);
      }).catch(() => {});
    }
  }, [poll, pollId]);

  // Listen for poll vote/close updates from socket (handled via chatStore)
  const handleOptionToggle = (optionId: string) => {
    if (hasVoted || poll?.isClosed) return;

    if (poll?.isMultiple) {
      setSelected((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      );
    } else {
      setSelected([optionId]);
    }
  };

  const handleVote = async () => {
    if (selected.length === 0 || !poll) return;
    setIsVoting(true);
    try {
      const res = await api.post(`/polls/${poll.id}/vote`, { optionIds: selected });
      const { counts, totalVoters } = res.data;

      // Update local vote counts
      setPoll((prev) => prev ? {
        ...prev,
        totalVoters,
        options: prev.options.map((o) => ({
          ...o,
          votes: Array.from({ length: counts[o.id] || 0 }).map(() => ({})),
        })),
        myVotes: selected,
      } : prev);

      setHasVoted(true);
    } catch (err) {
      console.error('Vote failed:', err);
    } finally {
      setIsVoting(false);
    }
  };

  if (!poll) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
        <BarChart2 className="w-4 h-4 animate-pulse" />
        <span>{question || 'Опрос'}</span>
      </div>
    );
  }

  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);

  const getPercent = (count: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((count / totalVotes) * 100);
  };

  const winnerCount = Math.max(...poll.options.map((o) => o.votes.length));

  return (
    <div className="min-w-[240px] max-w-[320px]">
      {/* Question */}
      <div className="flex items-start gap-2 mb-3">
        <BarChart2 className="w-4 h-4 text-tg-blue mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-[14px] leading-snug">{poll.question}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {poll.isAnonymous ? 'Анонимный' : 'Публичный'} опрос
            {poll.isMultiple && ' · Несколько ответов'}
            {poll.isClosed && ' · Завершён'}
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((option) => {
          const count   = option.votes.length;
          const pct     = getPercent(count);
          const isWin   = hasVoted && count === winnerCount && count > 0;
          const isVoted = selected.includes(option.id);
          const showBar = hasVoted || poll.isClosed;

          return (
            <button
              key={option.id}
              onClick={() => handleOptionToggle(option.id)}
              disabled={hasVoted || poll.isClosed || isVoting}
              className="w-full text-left relative overflow-hidden rounded-xl border transition-all"
              style={{
                borderColor: isVoted ? 'var(--tg-blue)' : 'rgba(0,0,0,0.1)',
              }}
            >
              {/* Progress bar background */}
              {showBar && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                    isWin ? 'bg-tg-blue/15' : 'bg-gray-100 dark:bg-gray-700/50'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              )}

              <div className="relative flex items-center justify-between px-3 py-2.5 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {!hasVoted && !poll.isClosed ? (
                    poll.isMultiple ? (
                      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                        isVoted ? 'bg-tg-blue border-tg-blue' : 'border-gray-300 dark:border-gray-500'
                      }`}>
                        {isVoted && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                    ) : (
                      isVoted
                        ? <CheckCircle2 className="w-4 h-4 text-tg-blue flex-shrink-0" />
                        : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )
                  ) : isWin ? (
                    <CheckCircle2 className="w-4 h-4 text-tg-blue flex-shrink-0" />
                  ) : null}
                  <span className="text-sm truncate">{option.text}</span>
                </div>

                {showBar && (
                  <span className={`text-xs font-medium flex-shrink-0 ${isWin ? 'text-tg-blue' : 'text-gray-500'}`}>
                    {pct}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {poll.isClosed ? (
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Завершён</span>
          ) : (
            `${totalVotes} ${totalVotes === 1 ? 'голос' : totalVotes >= 2 && totalVotes <= 4 ? 'голоса' : 'голосов'}`
          )}
        </span>

        {!hasVoted && !poll.isClosed && (
          <button
            onClick={handleVote}
            disabled={selected.length === 0 || isVoting}
            className="text-xs font-medium text-tg-blue disabled:opacity-40 hover:underline"
          >
            {isVoting ? 'Голосование...' : 'Проголосовать'}
          </button>
        )}
      </div>
    </div>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
