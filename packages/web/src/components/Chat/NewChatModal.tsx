import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Users, Megaphone } from 'lucide-react';
import { api } from '../../utils/api';
import { useChatStore } from '../../store/chatStore';
import { Avatar } from './Avatar';

interface NewChatModalProps {
  onClose: () => void;
}

type Mode = 'search' | 'create-group' | 'create-channel';

export function NewChatModal({ onClose }: NewChatModalProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { createPrivateChat, createGroupChat } = useChatStore();

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/search', { params: { q: query, type: 'users' } });
        setResults(res.data.users || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleUserClick = async (user: any) => {
    if (mode === 'search') {
      const chat = await createPrivateChat(user.id);
      navigate(`/chat/${chat.id}`);
      onClose();
    } else {
      setSelectedUsers((prev) =>
        prev.find((u) => u.id === user.id)
          ? prev.filter((u) => u.id !== user.id)
          : [...prev, user]
      );
    }
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;
    setIsLoading(true);
    try {
      const chat = await createGroupChat({
        name: groupName || 'New Group',
        memberIds: selectedUsers.map((u) => u.id),
        type: mode === 'create-channel' ? 'CHANNEL' : 'GROUP',
      });
      navigate(`/chat/${chat.id}`);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 top-0 z-50 bg-white dark:bg-gray-900 h-full max-w-sm mx-auto shadow-modal animate-slide-in-right">
        {/* Header */}
        <div className="tg-header">
          <button onClick={onClose} className="p-1 mr-2">
            <X className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="font-semibold text-gray-900 dark:text-white flex-1">New Message</h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-tg-divider dark:border-gray-700">
          {[
            { key: 'search', label: 'Direct', icon: null },
            { key: 'create-group', label: 'Group', icon: <Users className="w-4 h-4" /> },
            { key: 'create-channel', label: 'Channel', icon: <Megaphone className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setMode(tab.key as Mode); setSelectedUsers([]); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
                mode === tab.key
                  ? 'border-tg-blue text-tg-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        <div className="p-3">
          {/* Group name input */}
          {mode !== 'search' && (
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={mode === 'create-channel' ? 'Channel name' : 'Group name'}
              className="tg-input border border-tg-divider dark:border-gray-600 mb-3"
            />
          )}

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              className="tg-input border border-tg-divider dark:border-gray-600 pl-9"
            />
          </div>

          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedUsers.map((u) => (
                <div
                  key={u.id}
                  onClick={() => setSelectedUsers((prev) => prev.filter((x) => x.id !== u.id))}
                  className="flex items-center gap-1.5 bg-tg-blue/10 text-tg-blue rounded-full px-3 py-1 text-sm cursor-pointer hover:bg-tg-blue/20"
                >
                  <Avatar src={u.avatarUrl} name={u.displayName} size={18} />
                  {u.displayName}
                  <X className="w-3 h-3" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {results.map((user) => {
            const isSelected = selectedUsers.find((u) => u.id === user.id);
            return (
              <button
                key={user.id}
                onClick={() => handleUserClick(user)}
                className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  isSelected ? 'bg-tg-blue/5' : ''
                }`}
              >
                <Avatar src={user.avatarUrl} name={user.displayName} size={44} />
                <div className="text-left">
                  <div className="font-medium text-gray-900 dark:text-white">{user.displayName}</div>
                  <div className="text-sm text-gray-500">@{user.username}</div>
                </div>
                {isSelected && (
                  <div className="ml-auto w-5 h-5 bg-tg-blue rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Create button */}
        {mode !== 'search' && selectedUsers.length > 0 && (
          <div className="p-4 border-t border-tg-divider dark:border-gray-700">
            <button
              onClick={handleCreate}
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? 'Creating...' : `Create ${mode === 'create-channel' ? 'Channel' : 'Group'} (${selectedUsers.length})`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
