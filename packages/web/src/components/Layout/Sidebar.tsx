import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Edit, Moon, Sun, LogOut, UserCircle, ShieldCheck } from 'lucide-react';
import { useChatStore, Chat } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { StoriesBar } from '../Chat/StoriesBar';
import { NewChatModal } from '../Chat/NewChatModal';
import { Avatar } from '../Chat/Avatar';
import { EditProfileModal } from '../Profile/EditProfileModal';
import { formatChatTime, getChatName, getChatAvatar, getLastMessagePreview, getUnreadCount } from '../../utils/chatUtils';

interface SidebarProps {
  onChatSelect?: () => void;
}

export function Sidebar({ onChatSelect }: SidebarProps) {
  const navigate = useNavigate();
  const { chatId: activeChatId } = useParams();
  const { chats, isLoadingChats, selectChat } = useChatStore();
  const { user, logout } = useAuthStore();
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const filteredChats = chats.filter((chat) => {
    const name = getChatName(chat, user?.id || '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const handleChatSelect = async (chatId: string) => {
    await selectChat(chatId);
    navigate(`/chat/${chatId}`);
    onChatSelect?.();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 w-full">
      {/* Header */}
      <div className="tg-header flex-shrink-0 justify-between dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="relative"
          >
            <Avatar
              src={user?.avatarUrl}
              name={user?.displayName || 'Me'}
              size={36}
            />
          </button>
          <span className="font-semibold text-gray-900 dark:text-white">Messngr</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {darkMode
              ? <Sun className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              : <Moon className="w-5 h-5 text-gray-500" />
            }
          </button>
          <button
            onClick={() => setShowNewChat(true)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="New chat"
          >
            <Edit className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="tg-input pl-9 text-sm w-full border border-tg-divider dark:border-gray-600"
          />
        </div>
      </div>

      {/* Stories */}
      <StoriesBar />

      {/* Chats list */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingChats && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-tg-blue/30 border-t-tg-blue rounded-full animate-spin" />
          </div>
        )}

        {!isLoadingChats && filteredChats.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            {search ? 'No chats found' : 'No chats yet'}
          </div>
        )}

        {filteredChats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            currentUserId={user?.id || ''}
            isActive={chat.id === activeChatId}
            onClick={() => handleChatSelect(chat.id)}
          />
        ))}
      </div>

      {/* Bottom menu */}
      <div className="flex-shrink-0 border-t border-tg-divider dark:border-gray-700">
        <button
          onClick={() => setShowEditProfile(true)}
          className="flex items-center gap-3 w-full px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-sm"
        >
          <UserCircle className="w-4 h-4" />
          Edit Profile
        </button>
        {(user as any)?.isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-3 w-full px-4 py-3 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-sm"
          >
            <ShieldCheck className="w-4 h-4" />
            Admin Panel
          </button>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      {showEditProfile && <EditProfileModal onClose={() => setShowEditProfile(false)} />}
    </div>
  );
}

function ChatListItem({
  chat, currentUserId, isActive, onClick,
}: {
  chat: Chat; currentUserId: string; isActive: boolean; onClick: () => void;
}) {
  const name = getChatName(chat, currentUserId);
  const avatarSrc = getChatAvatar(chat, currentUserId);
  const lastMsg = getLastMessagePreview(chat.lastMessage, currentUserId);
  const unread = getUnreadCount(chat);

  const otherMember = chat.type === 'PRIVATE'
    ? chat.members?.find((m) => m.user.id !== currentUserId)
    : null;

  return (
    <div
      onClick={onClick}
      className={`chat-item dark:hover:bg-gray-700 ${isActive ? 'bg-tg-blue/10 dark:bg-tg-blue/20' : ''}`}
    >
      <div className="relative flex-shrink-0">
        <Avatar src={avatarSrc} name={name} size={52} />
        {otherMember?.user.status === 'ONLINE' && (
          <span className="online-dot border-white dark:border-gray-900" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`font-medium truncate text-[15px] ${isActive ? 'text-tg-blue dark:text-tg-blue-light' : 'text-gray-900 dark:text-white'}`}>
            {name}
          </span>
          {chat.lastMessage && (
            <span className="text-xs text-gray-400 flex-shrink-0">
              {formatChatTime(chat.lastMessage.sentAt)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{lastMsg}</span>
          {unread > 0 && (
            <span className="mention-badge flex-shrink-0">{unread > 99 ? '99+' : unread}</span>
          )}
          {chat.membership?.isMuted && (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-400 flex-shrink-0">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
