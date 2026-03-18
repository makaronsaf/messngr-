import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from './Avatar';

interface StoryUser {
  user: { id: string; displayName: string; avatarUrl?: string };
  stories: any[];
  hasUnread: boolean;
}

export function StoriesBar() {
  const [feed, setFeed] = useState<StoryUser[]>([]);
  const [selectedStory, setSelectedStory] = useState<StoryUser | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    api.get('/stories/feed')
      .then((res) => setFeed(res.data.feed))
      .catch(() => {});
  }, []);

  return (
    <div className="flex-shrink-0 border-b border-tg-divider dark:border-gray-700">
      <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
        {/* My story (add) */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer" onClick={() => {}}>
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-tg-blue flex items-center justify-center bg-tg-blue/10">
              <Plus className="w-5 h-5 text-tg-blue" />
            </div>
          </div>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-14 text-center">My Story</span>
        </div>

        {/* Others' stories */}
        {feed.map((item) => (
          <div
            key={item.user.id}
            className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer"
            onClick={() => setSelectedStory(item)}
          >
            <div className={`p-0.5 rounded-full ${item.hasUnread ? 'story-ring' : 'story-ring viewed'}`}>
              <div className="w-11 h-11 rounded-full bg-white p-0.5">
                <Avatar src={item.user.avatarUrl} name={item.user.displayName} size={44} />
              </div>
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-14 text-center">
              {item.user.displayName.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>

      {/* Story viewer */}
      {selectedStory && (
        <StoryViewer storyUser={selectedStory} onClose={() => setSelectedStory(null)} />
      )}
    </div>
  );
}

function StoryViewer({ storyUser, onClose }: { storyUser: StoryUser; onClose: () => void }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const currentStory = storyUser.stories[currentIdx];

  useEffect(() => {
    if (!currentStory) return;
    api.post(`/stories/${currentStory.id}/view`).catch(() => {});

    const timer = setTimeout(() => {
      if (currentIdx < storyUser.stories.length - 1) {
        setCurrentIdx((i) => i + 1);
      } else {
        onClose();
      }
    }, (currentStory.duration || 5) * 1000);

    return () => clearTimeout(timer);
  }, [currentIdx]);

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={onClose}>
      <div className="relative w-full max-w-sm h-[600px]" onClick={(e) => e.stopPropagation()}>
        {/* Progress bars */}
        <div className="absolute top-3 inset-x-3 flex gap-1 z-10">
          {storyUser.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className={`h-full bg-white rounded-full ${i < currentIdx ? 'w-full' : i === currentIdx ? 'animate-[story-progress_5s_linear_forwards]' : 'w-0'}`}
              />
            </div>
          ))}
        </div>

        {/* User info */}
        <div className="absolute top-8 inset-x-3 z-10 flex items-center gap-2">
          <Avatar src={storyUser.user.avatarUrl} name={storyUser.user.displayName} size={36} />
          <span className="text-white font-semibold text-sm">{storyUser.user.displayName}</span>
        </div>

        {/* Story media */}
        {currentStory.type === 'VIDEO' ? (
          <video
            src={currentStory.mediaUrl}
            autoPlay
            playsInline
            className="w-full h-full object-cover rounded-xl"
          />
        ) : (
          <img
            src={currentStory.mediaUrl}
            alt="Story"
            className="w-full h-full object-cover rounded-xl"
          />
        )}

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-4 inset-x-4 text-white text-center text-sm">
            {currentStory.caption}
          </div>
        )}

        {/* Navigation */}
        <button
          className="absolute left-0 top-0 bottom-0 w-1/3"
          onClick={() => currentIdx > 0 ? setCurrentIdx((i) => i - 1) : onClose()}
        />
        <button
          className="absolute right-0 top-0 bottom-0 w-1/3"
          onClick={() => currentIdx < storyUser.stories.length - 1 ? setCurrentIdx((i) => i + 1) : onClose()}
        />
      </div>
    </div>
  );
}
