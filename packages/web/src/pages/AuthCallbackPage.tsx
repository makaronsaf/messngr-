import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setTokenFromOAuth } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setTokenFromOAuth(token)
        .then(() => navigate('/', { replace: true }))
        .catch(() => navigate('/login', { replace: true }));
    } else {
      navigate('/login', { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-tg-blue to-tg-blue-dark">
      <div className="text-white text-center">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-lg">Signing in...</p>
      </div>
    </div>
  );
}
