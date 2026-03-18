import { useState } from 'react';
import { X, Shield, Lock, Monitor, ChevronRight } from 'lucide-react';
import { TwoFactorPanel } from './TwoFactorPanel';
import { SessionsPanel } from './SessionsPanel';
import { PrivacyPanel } from './PrivacyPanel';

type Tab = 'menu' | '2fa' | 'sessions' | 'privacy';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('menu');

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              {tab !== 'menu' && (
                <button
                  onClick={() => setTab('menu')}
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 mr-1"
                >
                  <ChevronRight className="w-4 h-4 text-gray-500 rotate-180" />
                </button>
              )}
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {tab === 'menu'     ? 'Settings'
                : tab === '2fa'     ? 'Two-Factor Auth'
                : tab === 'sessions' ? 'Active Sessions'
                : 'Privacy'}
              </h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'menu' && (
              <div className="p-4 space-y-2">
                <MenuItem
                  icon={<Shield className="w-5 h-5 text-tg-blue" />}
                  label="Two-Factor Authentication"
                  description="Add an extra layer of security"
                  onClick={() => setTab('2fa')}
                />
                <MenuItem
                  icon={<Lock className="w-5 h-5 text-purple-500" />}
                  label="Privacy Settings"
                  description="Control who can see your info"
                  onClick={() => setTab('privacy')}
                />
                <MenuItem
                  icon={<Monitor className="w-5 h-5 text-green-500" />}
                  label="Active Sessions"
                  description="Manage logged-in devices"
                  onClick={() => setTab('sessions')}
                />
              </div>
            )}

            {tab === '2fa'      && <TwoFactorPanel />}
            {tab === 'sessions' && <SessionsPanel />}
            {tab === 'privacy'  && <PrivacyPanel />}
          </div>
        </div>
      </div>
    </>
  );
}

function MenuItem({ icon, label, description, onClick }: {
  icon: React.ReactNode; label: string; description: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
    >
      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 dark:text-white">{label}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
    </button>
  );
}
