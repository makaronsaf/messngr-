import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../utils/api';
import { socketService } from '../utils/socket';

interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: false,

  loadFromStorage: async () => {
    const token = await AsyncStorage.getItem('token');
    const userStr = await AsyncStorage.getItem('user');
    if (token && userStr) {
      api.setToken(token);
      socketService.connect(token);
      set({ token, user: JSON.parse(userStr) });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      api.setToken(token);
      socketService.connect(token);
      set({ token, user, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (username, displayName, email, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/register', { username, displayName, email, password });
      const { token, user } = res.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      api.setToken(token);
      socketService.connect(token);
      set({ token, user, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    socketService.disconnect();
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    api.setToken(null);
    set({ token: null, user: null });
  },

  updateUser: (updates) => {
    const current = get().user;
    if (current) {
      const updated = { ...current, ...updates };
      set({ user: updated });
      AsyncStorage.setItem('user', JSON.stringify(updated));
    }
  },
}));
