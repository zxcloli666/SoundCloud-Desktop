import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiError, api, setSessionId } from '../lib/http';

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

function clearPersistedAuthSession() {
  try {
    localStorage.removeItem('sc-auth');
  } catch {
    // no-op
  }
}

function isBrokenSessionError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.status !== 401) return false;
  return err.body.includes('No refresh token available');
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      user: null,
      isAuthenticated: false,

      setSession: (sessionId: string) => {
        console.log('[Auth/Store] setSession', { sessionId: `${sessionId.slice(0, 8)}...` });
        setSessionId(sessionId);
        set({ sessionId, isAuthenticated: true });
      },

      fetchUser: async () => {
        const { sessionId } = get();
        if (!sessionId) {
          console.warn('[Auth/Store] fetchUser called without sessionId');
          return;
        }
        console.log('[Auth/Store] fetchUser start');
        setSessionId(sessionId);
        try {
          const user = await api<User>('/me');
          set({ user, isAuthenticated: true });
          console.log('[Auth/Store] fetchUser success', { urn: user.urn, username: user.username });
        } catch (err) {
          if (isBrokenSessionError(err)) {
            console.warn('[Auth/Store] broken persisted session detected, clearing local auth');
            clearPersistedAuthSession();
            setSessionId(null);
            set({ sessionId: null, user: null, isAuthenticated: false });
          }
          console.error('[Auth/Store] fetchUser failed', err);
          throw err;
        }
      },

      logout: () => {
        console.log('[Auth/Store] logout');
        clearPersistedAuthSession();
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
