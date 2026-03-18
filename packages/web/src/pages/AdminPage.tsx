import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, MessageSquare, BarChart2, ShieldCheck, Ban,
  ChevronLeft, Search, CheckCircle2, XCircle, Trash2,
  Activity, ArrowLeft,
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { Avatar } from '../components/Chat/Avatar';

type Tab = 'dashboard' | 'users' | 'chats' | 'logs';

export function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('dashboard');

  if (!(user as any)?.isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Доступ запрещён</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-tg-blue" />
          <h1 className="font-semibold text-gray-900 dark:text-white">Панель администратора</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 overflow-x-auto">
        {([
          { key: 'dashboard', icon: Activity,      label: 'Обзор' },
          { key: 'users',     icon: Users,          label: 'Пользователи' },
          { key: 'chats',     icon: MessageSquare,  label: 'Чаты' },
          { key: 'logs',      icon: BarChart2,      label: 'Журнал' },
        ] as const).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === key
                ? 'border-tg-blue text-tg-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'users'     && <UsersTab />}
        {tab === 'chats'     && <ChatsTab />}
        {tab === 'logs'      && <LogsTab />}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardTab() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/admin/stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-tg-blue/30 border-t-tg-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Пользователей"    value={stats.totalUsers}      icon="👤" />
        <StatCard label="Онлайн сейчас"   value={stats.activeUsers}     icon="🟢" color="green" />
        <StatCard label="Всего чатов"     value={stats.totalChats}      icon="💬" />
        <StatCard label="Всего сообщений" value={stats.totalMessages}   icon="📨" />
        <StatCard label="Новых сегодня"   value={stats.newUsersToday}   icon="🆕" color="blue" />
        <StatCard label="Сообщений сегодня" value={stats.newMessagesToday} icon="📬" color="blue" />
      </div>

      {/* Chart */}
      {stats.msgsByDay?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Сообщения (последние 7 дней)</h3>
          <MiniBarChart data={stats.msgsByDay} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xl font-bold ${color === 'green' ? 'text-green-600' : color === 'blue' ? 'text-tg-blue' : 'text-gray-900 dark:text-white'}`}>
          {value?.toLocaleString()}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

function MiniBarChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-tg-blue/70 rounded-t"
            style={{ height: `${(d.count / max) * 64}px`, minHeight: d.count > 0 ? '2px' : '0' }}
          />
          <span className="text-[9px] text-gray-400">{new Date(d.day).toLocaleDateString('ru', { month: 'short', day: 'numeric' })}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch]   = useState('');
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);

  const load = async (p = 1, q = search) => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users', { params: { page: p, limit: 30, search: q || undefined } });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setPage(p);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleBan = async (userId: string, ban: boolean) => {
    await api.patch(`/admin/users/${userId}/ban`, { ban });
    load(page);
  };

  const handleVerify = async (userId: string, verified: boolean) => {
    await api.patch(`/admin/users/${userId}/verify`, { verified });
    load(page);
  };

  return (
    <div className="p-4 space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(1, search)}
          placeholder="Поиск по имени, нику, email..."
          className="w-full bg-white dark:bg-gray-800 dark:text-white rounded-xl pl-9 pr-4 py-2.5 outline-none text-sm border border-gray-200 dark:border-gray-700"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-tg-blue/30 border-t-tg-blue rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Пользователь</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Сообщ.</th>
                <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map((u) => (
                <tr key={u.id} className={u.deletedAt ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar src={u.avatarUrl} name={u.displayName} size={32} />
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-gray-900 dark:text-white">{u.displayName}</span>
                          {u.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-tg-blue" />}
                          {u.isAdmin && <ShieldCheck className="w-3.5 h-3.5 text-orange-500" />}
                        </div>
                        <div className="text-xs text-gray-400">@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{u.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{u._count?.sentMessages ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleVerify(u.id, !u.isVerified)}
                        title={u.isVerified ? 'Снять верификацию' : 'Верифицировать'}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-tg-blue transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleBan(u.id, !u.deletedAt)}
                        title={u.deletedAt ? 'Разблокировать' : 'Заблокировать'}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500 transition-colors"
                      >
                        {u.deletedAt ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 30 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} пользователей</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => load(page - 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40">Назад</button>
            <button disabled={page * 30 >= total} onClick={() => load(page + 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40">Далее</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chats ────────────────────────────────────────────────────────────────────

function ChatsTab() {
  const [chats, setChats]   = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/chats', { params: { limit: 50 } })
      .then((r) => setChats(r.data.chats))
      .finally(() => setLoading(false));
  }, []);

  const handleVerify = async (chatId: string, verified: boolean) => {
    await api.patch(`/admin/chats/${chatId}/verify`, { verified });
    setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, isVerified: verified } : c));
  };

  return (
    <div className="p-4">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-tg-blue/30 border-t-tg-blue rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Чат</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Тип</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Участники</th>
                <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {chats.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar src={c.avatarUrl} name={c.name || 'Chat'} size={32} />
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-gray-900 dark:text-white">{c.name || 'Личный чат'}</span>
                        {c.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-tg-blue" />}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{c.type.toLowerCase()}</td>
                  <td className="px-4 py-3 text-gray-500">{c._count?.members ?? 0}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleVerify(c.id, !c.isVerified)}
                      title={c.isVerified ? 'Снять верификацию' : 'Верифицировать'}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-tg-blue transition-colors float-right"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

function LogsTab() {
  const [logs, setLogs]     = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/logs', { params: { limit: 50 } })
      .then((r) => setLogs(r.data.logs))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-tg-blue/30 border-t-tg-blue rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Администратор</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Действие</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Объект</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium hidden md:table-cell">Причина</th>
                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Время</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">@{log.admin?.username}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      log.action.includes('ban')  ? 'bg-red-100 text-red-700' :
                      log.action.includes('verify') ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{log.targetType}: {log.targetId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{log.reason || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
