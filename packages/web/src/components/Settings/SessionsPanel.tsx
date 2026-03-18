import { useEffect, useState } from 'react';
import { Monitor, Smartphone, Globe, Trash2, LogOut } from 'lucide-react';
import { api } from '../../utils/api';

interface Session {
  id: string;
  deviceName?: string;
  deviceType?: string;
  ipAddress?: string;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

export function SessionsPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    api.get('/auth/sessions').then((res) => {
      setSessions(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const revoke = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } finally {
      setRevoking(null);
    }
  };

  const revokeAll = async () => {
    setRevoking('all');
    try {
      await api.delete('/auth/sessions');
      setSessions((prev) => prev.filter((s) => s.isCurrent));
    } finally {
      setRevoking(null);
    }
  };

  const DeviceIcon = ({ type }: { type?: string }) => {
    if (type === 'mobile') return <Smartphone className="w-5 h-5" />;
    if (type === 'web') return <Globe className="w-5 h-5" />;
    return <Monitor className="w-5 h-5" />;
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="w-6 h-6 border-2 border-tg-blue/30 border-t-tg-blue rounded-full animate-spin" />
      </div>
    );
  }

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="p-4 space-y-3">
      {/* Current session */}
      {sessions.filter((s) => s.isCurrent).map((s) => (
        <div key={s.id} className="bg-tg-blue/10 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-tg-blue/20 flex items-center justify-center text-tg-blue">
              <DeviceIcon type={s.deviceType} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-white text-sm">
                {s.deviceName || 'This device'}
              </div>
              {s.ipAddress && (
                <div className="text-xs text-gray-500 dark:text-gray-400">{s.ipAddress}</div>
              )}
              <div className="text-xs text-tg-blue font-medium mt-0.5">Current session</div>
            </div>
          </div>
        </div>
      ))}

      {/* Other sessions */}
      {otherSessions.length > 0 && (
        <>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Other sessions ({otherSessions.length})
            </span>
            <button
              onClick={revokeAll}
              disabled={revoking === 'all'}
              className="text-xs text-red-500 font-medium hover:text-red-600 disabled:opacity-50 flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Revoke all
            </button>
          </div>

          {otherSessions.map((s) => (
            <div key={s.id} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                <DeviceIcon type={s.deviceType} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white text-sm">
                  {s.deviceName || 'Unknown device'}
                </div>
                {s.ipAddress && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">{s.ipAddress}</div>
                )}
                <div className="text-xs text-gray-400 mt-0.5">
                  Active {formatDate(s.lastActive)}
                </div>
              </div>
              <button
                onClick={() => revoke(s.id)}
                disabled={revoking === s.id}
                className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </>
      )}

      {otherSessions.length === 0 && (
        <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
          No other active sessions
        </div>
      )}
    </div>
  );
}
