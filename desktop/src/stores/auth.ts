import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setSessionId } from '../lib/api';

interface User {
  id: number;
  urn: string;
  username: string;
  avatar_url: string;
  permalink_url: string;
  followers_count: number;
  followings_count: number;
  track_count: number;
  playlist_count: number;
  public_favorites_count: number;
}

interface AuthState {
  sessionId: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setSession: (sessionId: string) => void;
  fetchUser: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      user: null,
      isAuthenticated: false,

      setSession: (sessionId: string) => {
        setSessionId(sessionId);
        set({ sessionId, isAuthenticated: true });
      },

      fetchUser: async () => {
        const { sessionId } = get();
        if (!sessionId) return;
        setSessionId(sessionId);
        const user = await api<User>('/me');
        set({ user, isAuthenticated: true });
      },

      logout: () => {
        setSessionId(null);
        set({ sessionId: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'sc-auth',
      partialize: (state) => ({ sessionId: state.sessionId }),
      onRehydrateStorage: () => (state) => {
        if (state?.sessionId) {
          setSessionId(state.sessionId);
        }
      },
    },
  ),
);
