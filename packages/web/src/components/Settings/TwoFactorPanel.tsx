import { useState } from 'react';
import { Shield, ShieldCheck, ShieldOff, Copy, Check } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';

type Step = 'status' | 'setup' | 'disable';

export function TwoFactorPanel() {
  const { user, updateUser } = useAuthStore();
  const [step, setStep] = useState<Step>('status');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const enabled = (user as any)?.twoFactorEnabled ?? false;

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/2fa/setup');
      setSecret(res.data.secret);
      setOtpauthUrl(res.data.otpauthUrl);
      setStep('setup');
    } catch {
      setError('Не удалось начать настройку');
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    if (code.length !== 6) { setError('Введите 6-значный код'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/2fa/enable', { code });
      updateUser({ twoFactorEnabled: true });
      setStep('status');
      setCode('');
    } catch {
      setError('Неверный код. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (code.length !== 6) { setError('Введите 6-значный код'); return; }
    setLoading(true);
    setError('');
    try {
      await api.delete('/auth/2fa', { data: { code } });
      updateUser({ twoFactorEnabled: false });
      setStep('status');
      setCode('');
    } catch {
      setError('Неверный код. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'setup') {
    return (
      <div className="p-5 space-y-5">
        <div className="bg-tg-blue/10 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            1. Откройте приложение-аутентификатор (Google Authenticator, Authy и т. д.)
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            2. Добавьте новый аккаунт и введите этот секретный ключ вручную:
          </p>
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
            <code className="flex-1 text-sm font-mono text-gray-800 dark:text-gray-200 break-all">{secret}</code>
            <button onClick={copySecret} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
            Или используйте этот URL: <span className="font-mono text-[10px]">{otpauthUrl}</span>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            3. Введите 6-значный код для подтверждения
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
            placeholder="000000"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-tg-blue"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { setStep('status'); setCode(''); setError(''); }}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Отмена
          </button>
          <button
            onClick={handleEnable}
            disabled={loading || code.length !== 6}
            className="flex-1 py-2.5 rounded-xl bg-tg-blue text-white text-sm font-medium hover:bg-tg-blue/90 disabled:opacity-50"
          >
            {loading ? 'Проверка...' : 'Включить 2FA'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'disable') {
    return (
      <div className="p-5 space-y-5">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">
            Введите текущий код из приложения-аутентификатора для отключения двухфакторной аутентификации.
          </p>
        </div>
        <div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
            placeholder="000000"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setStep('status'); setCode(''); setError(''); }}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Отмена
          </button>
          <button
            onClick={handleDisable}
            disabled={loading || code.length !== 6}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? 'Отключение...' : 'Отключить 2FA'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      <div className={`flex items-center gap-4 p-4 rounded-2xl ${enabled ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
        {enabled
          ? <ShieldCheck className="w-10 h-10 text-green-500 flex-shrink-0" />
          : <Shield className="w-10 h-10 text-gray-400 flex-shrink-0" />
        }
        <div>
          <div className={`font-semibold ${enabled ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {enabled ? '2FA включена' : '2FA отключена'}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {enabled
              ? 'Ваш аккаунт защищён одноразовым паролем.'
              : 'Добавьте дополнительный уровень защиты к своему аккаунту.'}
          </p>
        </div>
      </div>

      {enabled ? (
        <button
          onClick={() => setStep('disable')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
        >
          <ShieldOff className="w-4 h-4" />
          Отключить двухфакторную аутентификацию
        </button>
      ) : (
        <button
          onClick={handleSetup}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-tg-blue text-white font-medium hover:bg-tg-blue/90 transition-colors disabled:opacity-50"
        >
          <Shield className="w-4 h-4" />
          {loading ? 'Загрузка...' : 'Настроить двухфакторную аутентификацию'}
        </button>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Использует одноразовые пароли на основе времени (TOTP), совместимые с Google Authenticator, Authy и другими приложениями.
      </p>
    </div>
  );
}
