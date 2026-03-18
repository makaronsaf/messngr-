import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Lock, Globe, ArrowLeft } from 'lucide-react';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { Avatar } from '../components/Chat/Avatar';

interface ChatPreview {
  id: string;
  name?: string;
  avatarUrl?: string;
  type: string;
  memberCount: number;
  description?: string;
  isPublic?: boolean;
}

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { token: authToken } = useAuthStore();
  const { selectChat } = useChatStore();
  const [chat, setChat] = useState<ChatPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get(`/chats/invite/${token}`)
      .then((res) => setChat(res.data))
      .catch((err) => {
        if (err?.response?.status === 404) setNotFound(true);
        else setError('Не удалось загрузить приглашение');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleJoin = async () => {
    if (!authToken) {
      navigate(`/login?redirect=/invite/${token}`);
      return;
    }
    setJoining(true);
    try {
      const res = await api.post(`/chats/invite/${token}/join`);
      const chatId = res.data.chatId || res.data.id;
      await selectChat(chatId);
      navigate(`/chat/${chatId}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось вступить в чат');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-tg-blue/30 border-t-tg-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Неверная ссылка</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ссылка недействительна или устарела.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-xl bg-tg-blue text-white font-medium hover:bg-tg-blue/90"
          >
            Открыть Messngr
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-tg-blue to-blue-600 px-6 py-8 text-center">
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Avatar
            src={chat?.avatarUrl}
            name={chat?.name || 'Chat'}
            size={72}
            className="mx-auto ring-4 ring-white/30"
          />
          <h1 className="mt-3 text-xl font-bold text-white">{chat?.name}</h1>
          <div className="flex items-center justify-center gap-1.5 mt-1 text-blue-100 text-sm">
            {chat?.isPublic
              ? <Globe className="w-3.5 h-3.5" />
              : <Lock className="w-3.5 h-3.5" />
            }
            <span>{chat?.type === 'GROUP' ? 'Группа' : chat?.type === 'CHANNEL' ? 'Канал' : 'Чат'}</span>
            <span>·</span>
            <Users className="w-3.5 h-3.5" />
            <span>{chat?.memberCount} участников</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {chat?.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {chat.description}
            </p>
          )}

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}

          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-3 rounded-xl bg-tg-blue text-white font-medium hover:bg-tg-blue/90 disabled:opacity-50 transition-colors"
          >
            {joining ? 'Вступление...' : authToken ? 'Вступить' : 'Войти и вступить'}
          </button>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            Вступая, вы соглашаетесь с правилами сообщества.
          </p>
        </div>
      </div>
    </div>
  );
}
