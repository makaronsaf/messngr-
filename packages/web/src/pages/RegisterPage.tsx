import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function RegisterPage() {
  const { register, isLoading } = useAuthStore();
  const [form, setForm] = useState({
    username: '', displayName: '', email: '', password: '', confirmPassword: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      return setError('Пароли не совпадают');
    }
    try {
      await register(form.username, form.displayName, form.email, form.password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка регистрации');
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-tg-blue to-tg-blue-dark py-8">
      <div className="bg-white rounded-2xl shadow-modal p-8 w-full max-w-sm mx-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-tg-blue rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg viewBox="0 0 24 24" fill="white" className="w-10 h-10">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Создать аккаунт</h1>
          <p className="text-tg-text-secondary text-sm mt-1">Присоединяйтесь к Messngr</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
            <input
              type="text"
              value={form.displayName}
              onChange={update('displayName')}
              placeholder="Иван Иванов"
              required
              className="tg-input border border-tg-divider"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имя пользователя</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
              <input
                type="text"
                value={form.username}
                onChange={update('username')}
                placeholder="username"
                required
                pattern="[a-zA-Z0-9_]+"
                minLength={3}
                className="tg-input border border-tg-divider pl-7"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Электронная почта</label>
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="ваш@email.com"
              required
              className="tg-input border border-tg-divider"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              placeholder="Минимум 8 символов"
              required
              minLength={8}
              className="tg-input border border-tg-divider"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Подтвердите пароль</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              placeholder="Повторите пароль"
              required
              className="tg-input border border-tg-divider"
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary w-full mt-2">
            {isLoading ? 'Создание аккаунта...' : 'Создать аккаунт'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-tg-blue font-medium hover:underline">Войти</Link>
        </p>
      </div>
    </div>
  );
}
