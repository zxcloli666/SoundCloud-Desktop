import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth';
import { ApiError, api } from './api';
import { onApiWrite } from './api-writes';
import { queryClient } from './query-client';

export interface SyncStatus {
  pendingCount: number;
  failedCount: number;
  delayedCount: number;
  retryInSec: number | null;
}

export type SyncState = 'synced' | 'syncing' | 'delayed' | 'failed';

const SYNC_KEY = ['me', 'sync'] as const;
const POLL_MS = 30_000;
const BACKEND_CACHE_MS = 6_000;
const SYNCED_WRITE = /^\/(likes|me\/followings|playlists|tracks|reposts)\//;

onApiWrite((path) => {
  if (!SYNCED_WRITE.test(path)) return;
  setTimeout(() => queryClient.invalidateQueries({ queryKey: SYNC_KEY }), BACKEND_CACHE_MS);
});

async function fetchSyncStatus(): Promise<SyncStatus | null> {
  try {
    const raw = await api<Partial<SyncStatus>>('/me/sync', { silentStatuses: [404], quiet: true });
    return {
      pendingCount: raw.pendingCount ?? 0,
      failedCount: raw.failedCount ?? 0,
      delayedCount: raw.delayedCount ?? 0,
      retryInSec: raw.retryInSec ?? null,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function syncStateOf(status: SyncStatus): SyncState {
  if (status.delayedCount > 0) return 'delayed';
  if (status.failedCount > 0) return 'failed';
  if (status.pendingCount > 0) return 'syncing';
  return 'synced';
}

export function useSyncStatus(opts?: { enabled?: boolean }) {
  const hasSession = useAuthStore((s) => s.hasSession);
  return useQuery<SyncStatus | null>({
    queryKey: SYNC_KEY,
    queryFn: fetchSyncStatus,
    staleTime: POLL_MS / 2,
    refetchInterval: POLL_MS,
    retry: false,
    enabled: hasSession && (opts?.enabled ?? true),
  });
}
