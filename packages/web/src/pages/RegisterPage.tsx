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
      return setError('Passwords do not match');
    }
    try {
      await register(form.username, form.displayName, form.email, form.password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
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
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-tg-text-secondary text-sm mt-1">Join Messngr today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              value={form.displayName}
              onChange={update('displayName')}
              placeholder="John Doe"
              required
              className="tg-input border border-tg-divider"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="your@email.com"
              required
              className="tg-input border border-tg-divider"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              placeholder="Min. 8 characters"
              required
              minLength={8}
              className="tg-input border border-tg-divider"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              placeholder="Repeat password"
              required
              className="tg-input border border-tg-divider"
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary w-full mt-2">
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-tg-blue font-medium hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
