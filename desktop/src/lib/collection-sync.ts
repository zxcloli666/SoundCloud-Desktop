import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { waitAnchor } from './sync-wait';

export interface CollectionSync {
  status: string;
  conflictCode?: string | null;
  lastCompletedAt?: string | null;
  retryAfterSeconds?: number;
  queuedSince?: string | null;
  errorCode?: string | null;
}

export type CollectionSyncState = 'complete' | 'syncing' | 'stalled' | 'refused';

export interface CollectionSyncInfo {
  state: CollectionSyncState;
  errorCode: string | null;
  queuedSince: string | null;
  waitingSince: number;
  retryAt: number;
}

interface SyncedPage {
  collection: unknown[];
  sync?: CollectionSync;
}

const MIN_PROBE_MS = 10_000;
const MAX_PROBE_MS = 60_000;
const PROBE_BUDGET_MS = 15 * 60_000;
const STALLED_PROBE_MS = 5 * 60_000;
const STALLED_PROBE_LIMIT = 12;
const STALLED_QUEUE_MS = 15 * 60_000;
const UNOBSERVED_PLAYLIST_STATUSES = ['unhydrated', 'legacy_review', 'retry_wait'];

export function isWaiting(sync: CollectionSync | undefined): boolean {
  if (sync?.errorCode) return false;
  if (sync?.status === 'conflict') return sync.conflictCode === 'catalog_incomplete';
  return sync?.status === 'refreshing' || UNOBSERVED_PLAYLIST_STATUSES.includes(sync?.status ?? '');
}

export function isPartialSync(sync: CollectionSync | undefined): boolean {
  if (sync?.errorCode) return false;
  if (UNOBSERVED_PLAYLIST_STATUSES.includes(sync?.status ?? '')) return true;
  return sync?.status === 'refreshing' && !sync.lastCompletedAt;
}

export function useCollectionSync(
  queryKey: QueryKey,
  probeUrl: string,
  head: SyncedPage | undefined,
  updatedAt: number,
): CollectionSyncInfo {
  const qc = useQueryClient();
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;
  const [stalledAt, setStalledAt] = useState(0);

  const status = head?.sync?.status;
  const conflictCode = head?.sync?.conflictCode ?? null;
  const lastCompletedAt = head?.sync?.lastCompletedAt ?? null;
  const retryAfterSeconds = head?.sync?.retryAfterSeconds ?? 0;
  const queuedSince = head?.sync?.queuedSince ?? null;
  const errorCode = head?.sync?.errorCode ?? null;
  const hasItems = (head?.collection.length ?? 0) > 0;
  const waiting = isWaiting(head?.sync);
  const stalledFrom = queuedSince ? Date.parse(queuedSince) + STALLED_QUEUE_MS : Number.NaN;

  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = Math.min(Math.max(retryAfterSeconds * 1000, MIN_PROBE_MS), MAX_PROBE_MS);
    const deadline = Date.now() + PROBE_BUDGET_MS;
    let stalledProbes = 0;

    function schedule() {
      const late = Date.now() + delay > deadline;
      if (late) {
        setStalledAt(updatedAt);
        if (stalledProbes++ >= STALLED_PROBE_LIMIT) return;
      }
      timer = setTimeout(probe, late ? STALLED_PROBE_MS : delay);
      delay = Math.min(delay * 1.5, MAX_PROBE_MS);
    }

    async function probe() {
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(probe, STALLED_PROBE_MS);
        return;
      }
      const latest = await api<SyncedPage>(probeUrl).catch(() => null);
      if (cancelled) return;
      const moved =
        latest !== null &&
        (latest.sync?.status !== status ||
          (latest.sync?.conflictCode ?? null) !== conflictCode ||
          (latest.sync?.lastCompletedAt ?? null) !== lastCompletedAt ||
          (latest.sync?.errorCode ?? null) !== errorCode ||
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
  }, [
    qc,
    probeUrl,
    waiting,
    status,
    conflictCode,
    lastCompletedAt,
    errorCode,
    retryAfterSeconds,
    hasItems,
    updatedAt,
  ]);

  useEffect(() => {
    const left = stalledFrom - Date.now();
    if (!waiting || !(left > 0)) return;
    const timer = setTimeout(() => setStalledAt(updatedAt), left);
    return () => clearTimeout(timer);
  }, [waiting, stalledFrom, updatedAt]);

  const retryAt = updatedAt + retryAfterSeconds * 1000;

  useEffect(() => {
    if (errorCode !== 'unavailable' || retryAfterSeconds <= 0) return;
    const timer = setTimeout(
      () =>
        void qc.invalidateQueries(
          { queryKey: queryKeyRef.current, exact: true },
          { cancelRefetch: false },
        ),
      retryAt - Date.now() + MIN_PROBE_MS,
    );
    return () => clearTimeout(timer);
  }, [qc, errorCode, retryAfterSeconds, retryAt]);

  const stalled = stalledAt === updatedAt || stalledFrom <= Date.now();
  const state: CollectionSyncState = errorCode
    ? 'refused'
    : !isPartialSync(head?.sync)
      ? 'complete'
      : stalled
        ? 'stalled'
        : 'syncing';
  const waitingSince = waitAnchor(probeUrl, head ? state : null, queuedSince, Date.now());
  return useMemo(
    () => ({ state, errorCode, queuedSince, waitingSince, retryAt }),
    [state, errorCode, queuedSince, waitingSince, retryAt],
  );
}
