import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';

export interface CollectionSync {
  status: string;
  lastCompletedAt?: string | null;
  retryAfterSeconds?: number;
}

export type CollectionSyncState = 'complete' | 'syncing' | 'stalled';

interface SyncedPage {
  collection: unknown[];
  sync?: CollectionSync;
}

const MIN_PROBE_MS = 10_000;
const MAX_PROBE_MS = 60_000;
const PROBE_BUDGET_MS = 15 * 60_000;
const UNOBSERVED_PLAYLIST_STATUSES = ['unhydrated', 'legacy_review', 'retry_wait'];

function isWaiting(status: string | undefined): boolean {
  return status === 'refreshing' || UNOBSERVED_PLAYLIST_STATUSES.includes(status ?? '');
}

export function isPartialSync(sync: CollectionSync | undefined): boolean {
  if (UNOBSERVED_PLAYLIST_STATUSES.includes(sync?.status ?? '')) return true;
  return sync?.status === 'refreshing' && !sync.lastCompletedAt;
}

export function useCollectionSync(
  queryKey: QueryKey,
  probeUrl: string,
  head: SyncedPage | undefined,
  updatedAt: number,
): CollectionSyncState {
  const qc = useQueryClient();
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;
  const [stalledAt, setStalledAt] = useState(0);

  const status = head?.sync?.status;
  const lastCompletedAt = head?.sync?.lastCompletedAt ?? null;
  const retryAfterSeconds = head?.sync?.retryAfterSeconds ?? 0;
  const hasItems = (head?.collection.length ?? 0) > 0;
  const waiting = isWaiting(status);

  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = Math.min(Math.max(retryAfterSeconds * 1000, MIN_PROBE_MS), MAX_PROBE_MS);
    const deadline = Date.now() + PROBE_BUDGET_MS;

    function schedule() {
      if (Date.now() + delay > deadline) {
        setStalledAt(updatedAt);
        return;
      }
      timer = setTimeout(probe, delay);
      delay = Math.min(delay * 1.5, MAX_PROBE_MS);
    }

    async function probe() {
      const latest = await api<SyncedPage>(probeUrl).catch(() => null);
      if (cancelled) return;
      const moved =
        latest !== null &&
        (latest.sync?.status !== status ||
          (latest.sync?.lastCompletedAt ?? null) !== lastCompletedAt ||
          latest.collection.length > 0 !== hasItems);
      if (moved) {
        await qc.invalidateQueries(
          { queryKey: queryKeyRef.current, exact: true },
          { cancelRefetch: false },
        );
      }
      if (!cancelled) schedule();
    }

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [qc, probeUrl, waiting, status, lastCompletedAt, retryAfterSeconds, hasItems, updatedAt]);

  if (!isPartialSync(head?.sync)) return 'complete';
  return stalledAt === updatedAt ? 'stalled' : 'syncing';
}
