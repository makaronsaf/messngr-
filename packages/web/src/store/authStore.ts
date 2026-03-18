import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { api } from '../utils/api';
import { socketService } from '../utils/socket';

// Request browser push notification permission and register FCM token if VAPID key is set
async function registerPushToken() {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // If using Firebase Web Push, the app should handle FCM token retrieval separately.
    // Here we check for a vapidKey in the env and register a minimal service worker
    // so the browser can receive web push notifications via standard Push API.
    const vapidKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });

    // Send subscription to backend (as fcmToken string representation)
    await api.post('/push/register', { fcmToken: JSON.stringify(sub) });
  } catch (_) {
    // Push notification setup is optional — fail silently
  }
}

interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  twoFactorEnabled?: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => void;
  updateUser: (user: Partial<User>) => void;
  setTokenFromOAuth: (token: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  immer((set, get) => ({
    token: null,
    user: null,
    isLoading: false,

    loadFromStorage: () => {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      if (token && user) {
        set((state) => {
          state.token = token;
          state.user = JSON.parse(user);
        });
        api.setToken(token);
        socketService.connect(token);
      }
    },

    login: async (email, password) => {
      set((state) => { state.isLoading = true; });
      try {
        const res = await api.post('/auth/login', { email, password });
        const { token, user } = res.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        set((state) => {
          state.token = token;
          state.user = user;
          state.isLoading = false;
        });

        api.setToken(token);
        socketService.connect(token);
        registerPushToken().catch(() => {});
      } catch (err) {
        set((state) => { state.isLoading = false; });
        throw err;
      }
    },

    register: async (username, displayName, email, password) => {
      set((state) => { state.isLoading = true; });
      try {
        const res = await api.post('/auth/register', { username, displayName, email, password });
        const { token, user } = res.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        set((state) => {
          state.token = token;
          state.user = user;
          state.isLoading = false;
        });

        api.setToken(token);
        socketService.connect(token);
        registerPushToken().catch(() => {});
      } catch (err) {
        set((state) => { state.isLoading = false; });
        throw err;
      }
    },

    logout: async () => {
      try {
        await api.post('/auth/logout');
        await api.delete('/push/register');
      } catch {}
      socketService.disconnect();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      api.setToken(null);
      set((state) => {
        state.token = null;
        state.user = null;
      });
    },

    updateUser: (updates) => {
      set((state) => {
        if (state.user) {
          Object.assign(state.user, updates);
          localStorage.setItem('user', JSON.stringify(state.user));
        }
      });
    },

    setTokenFromOAuth: async (token) => {
      localStorage.setItem('token', token);
      api.setToken(token);

      const res = await api.get('/auth/me');
      const user = res.data.user;
      localStorage.setItem('user', JSON.stringify(user));

      set((state) => {
        state.token = token;
        state.user = user;
      });

      socketService.connect(token);
    },
  }))
);
