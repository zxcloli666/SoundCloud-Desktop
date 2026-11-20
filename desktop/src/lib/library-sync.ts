import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useReducer } from 'react';
import { toast } from 'sonner';
import i18n from '../i18n';
import { useAuthStore } from '../stores/auth';
import { ApiError, api } from './api';

export interface LibrarySync {
  status: 'queued' | 'cooldown' | 'ready';
  availableAt: string;
}

const LIBRARY_SYNC_KEY = ['me', 'library-sync'] as const;
const LIBRARY_SYNC_STALE_MS = 5 * 60_000;

async function fetchLibrarySync(): Promise<LibrarySync | null> {
  try {
    return await api<LibrarySync>('/me/library/sync', { silentStatuses: [404], quiet: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function useLibrarySync(enabled: boolean) {
  const qc = useQueryClient();
  const hasSession = useAuthStore((s) => s.hasSession);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const query = useQuery<LibrarySync | null>({
    queryKey: LIBRARY_SYNC_KEY,
    queryFn: fetchLibrarySync,
    staleTime: LIBRARY_SYNC_STALE_MS,
    retry: false,
    enabled: hasSession && enabled,
  });
  const press = useMutation({
    mutationFn: () => api<LibrarySync>('/me/library/sync', { method: 'POST', quiet: true }),
    onSuccess: (state) => {
      qc.setQueryData(LIBRARY_SYNC_KEY, state);
      if (state.status !== 'queued') return;
      void qc.invalidateQueries({ queryKey: ['me', 'likes'] });
      void qc.invalidateQueries({ queryKey: ['me', 'playlists'] });
    },
    onError: () => toast.error(i18n.t('syncNow.failed'), { id: 'library-sync-failed' }),
  });

  const availableAt = query.data ? Date.parse(query.data.availableAt) : 0;
  const left = query.data?.status === 'ready' ? 0 : availableAt - Date.now();

  useEffect(() => {
    if (!(left > 0)) return;
    const timer = setTimeout(rerender, left);
    return () => clearTimeout(timer);
  }, [left]);

  return {
    supported: !!query.data,
    ready: !(left > 0),
    availableAt,
    pending: press.isPending,
    press: press.mutate,
  };
}
