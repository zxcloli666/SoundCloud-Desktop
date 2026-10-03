import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface SyncStatus {
  pendingCount: number;
  failedCount: number;
}

const POLL_MS = 30_000;

export function useSyncStatus(opts?: { enabled?: boolean }) {
  return useQuery<SyncStatus>({
    queryKey: ['me', 'sync'],
    queryFn: () => api<SyncStatus>('/me/sync'),
    staleTime: POLL_MS / 2,
    refetchInterval: POLL_MS,
    enabled: opts?.enabled ?? true,
  });
}
