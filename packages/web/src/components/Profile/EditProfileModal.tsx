import { useState, useRef } from 'react';
import { X, Camera, Check, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { Avatar } from '../Chat/Avatar';

interface EditProfileModalProps {
  onClose: () => void;
}

export function EditProfileModal({ onClose }: EditProfileModalProps) {
  const { user, updateUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername]       = useState(user?.username || '');
  const [bio, setBio]                 = useState(user?.bio || '');
  const [isPublic, setIsPublic]       = useState((user as any)?.isPublic ?? true);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile]   = useState<File | null>(null);
  const [isSaving, setIsSaving]       = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!displayName.trim()) { setError('Имя обязательно'); return; }
    if (username && !/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      setError('Имя пользователя: 3–32 символа, только буквы/цифры/_');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      // 1. Upload avatar if changed
      let newAvatarUrl = user?.avatarUrl;
      if (avatarFile) {
        const res = await api.upload('/media/avatar', avatarFile);
        newAvatarUrl = res.data.avatarUrl;
      }

      // 2. Update profile
      const res = await api.patch('/users/me', {
        displayName: displayName.trim(),
        username:    username.trim() || undefined,
        bio:         bio.trim() || null,
        avatarUrl:   newAvatarUrl || null,
        isPublic,
      });

      updateUser({ ...res.data.user, avatarUrl: newAvatarUrl });
      setSuccess(true);
      setTimeout(onClose, 800);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white text-lg">Редактировать профиль</h2>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Avatar */}
            <div className="flex justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative group"
              >
                <Avatar
                  src={avatarPreview || user?.avatarUrl}
                  name={user?.displayName || ''}
                  size={88}
                />
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* Display name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Имя
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={64}
                className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white rounded-xl px-4 py-2.5 outline-none text-sm border border-transparent focus:border-tg-blue transition-colors"
                placeholder="Ваше имя"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Имя пользователя
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  maxLength={32}
                  className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white rounded-xl pl-8 pr-4 py-2.5 outline-none text-sm border border-transparent focus:border-tg-blue transition-colors"
                  placeholder="username"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Ваша ссылка: messngr.app/@{username || 'username'}</p>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                О себе
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white rounded-xl px-4 py-2.5 outline-none text-sm resize-none border border-transparent focus:border-tg-blue transition-colors"
                placeholder="Несколько слов о вас..."
              />
              <p className="text-xs text-gray-400 text-right">{bio.length}/500</p>
            </div>

            {/* Public profile toggle */}
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Публичный профиль</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Любой может просматривать ваш профиль по имени пользователя</div>
              </div>
              <button
                onClick={() => setIsPublic(!isPublic)}
                className={`w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-tg-blue' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 pb-5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-tg-blue text-white text-sm font-medium hover:bg-tg-blue-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : success ? (
                <Check className="w-4 h-4" />
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
