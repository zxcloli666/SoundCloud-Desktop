import { create } from 'zustand';
import { fetchWithAuthFallback, getSessionId } from '../lib/api';
import { applyAuthFromServer } from '../lib/auth-session';
import { API_BASE } from '../lib/constants';
import { trackedInvoke as invoke } from '../lib/diagnostics';

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
  public_favorites_count?: number;
  likes_count?: number;
}

interface AuthState {
  /** Validated session — `/me` resolved. Gates authenticated UI. */
  isAuthenticated: boolean;
  /** Token present (Rust-owned). Lets the shell render before `/me` lands. */
  hasSession: boolean;
  user: User | null;
  setSession: (token: string) => Promise<void>;
  fetchUser: () => Promise<void>;
  renewSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  isAuthenticated: false,
  hasSession: false,
  user: null,

  setSession: async (token: string) => {
    await invoke('auth_set_session', { token });
    // Apply synchronously so the mirror is set before any fetchUser() that
    // follows — the auth:changed broadcast may not have landed yet.
    applyAuthFromServer(token);
  },

  fetchUser: async () => {
    const token = getSessionId();
    if (!token) return;
    const user = await fetchWithAuthFallback<User>('/me/cold');
    // Session changed (logout / re-login) while we awaited — drop the result.
    if (getSessionId() !== token) return;
    set({ user, isAuthenticated: true });
  },

  renewSession: async () => {
    await fetchWithAuthFallback('/auth/refresh', { method: 'POST' });
    await get().fetchUser();
  },

  logout: async () => {
    // Локальная чистка безусловна: Rust удаляет сессию до сетевого revoke.
    await invoke('auth_logout', { apiBase: API_BASE });
    applyAuthFromServer(null);
  },
}));
