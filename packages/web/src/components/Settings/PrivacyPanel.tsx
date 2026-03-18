import { useEffect, useState } from 'react';
import { api } from '../../utils/api';

type PrivacyLevel = 'EVERYONE' | 'CONTACTS' | 'NOBODY';

interface PrivacySettings {
  lastSeenPrivacy: PrivacyLevel;
  profilePhotoPrivacy: PrivacyLevel;
  allowMessagesFrom: PrivacyLevel;
}

const options: { value: PrivacyLevel; label: string; description: string }[] = [
  { value: 'EVERYONE', label: 'Все', description: 'Любые пользователи' },
  { value: 'CONTACTS', label: 'Мои контакты', description: 'Только люди из ваших контактов' },
  { value: 'NOBODY', label: 'Никто', description: 'Полностью скрыто' },
];

function PrivacySelector({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: PrivacyLevel;
  onChange: (v: PrivacyLevel) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</div>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <input
              type="radio"
              name={label}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
              className="accent-tg-blue"
            />
            <div>
              <div className="text-sm text-gray-900 dark:text-white">{opt.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{opt.description}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export function PrivacyPanel() {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/privacy').then((res) => setSettings(res.data));
  }, []);

  const update = (key: keyof PrivacySettings, value: PrivacyLevel) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(true);
    setSaved(false);
    api.patch('/privacy', { [key]: value })
      .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); })
      .finally(() => setSaving(false));
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="w-6 h-6 border-2 border-tg-blue/30 border-t-tg-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {saved && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs text-center py-2 rounded-xl">
          Настройки сохранены
        </div>
      )}

      <PrivacySelector
        label="Последний визит и «в сети»"
        value={settings.lastSeenPrivacy}
        onChange={(v) => update('lastSeenPrivacy', v)}
        disabled={saving}
      />

      <PrivacySelector
        label="Фото профиля"
        value={settings.profilePhotoPrivacy}
        onChange={(v) => update('profilePhotoPrivacy', v)}
        disabled={saving}
      />

      <PrivacySelector
        label="Кто может писать мне"
        value={settings.allowMessagesFrom}
        onChange={(v) => update('allowMessagesFrom', v)}
        disabled={saving}
      />
    </div>
  );
}
