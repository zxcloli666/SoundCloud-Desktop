import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiError, apiRequest } from './api-client';
import { getCurrentTime, subscribe } from './audio';
import {
  guardLink,
  mobileWrite,
  noteReadRefusal,
  useMobileButtons,
  useMobileReads,
} from './mobile-actions';
import {
  getMoment,
  type MomentReading,
  restoreMoment,
  seedMoments,
  setOwnReaction,
} from './moment-reactions';
import { queryClient } from './query-client';

const WINDOW = 40;
const MAX_WINDOWS = 6;
const READ_STALE_MS = 120_000;
const VALUES_STALE_MS = 60 * 60_000;

export interface ReactionValue {
  valueUrn: string;
  emoji: string;
}

interface MomentsReply {
  moments: MomentReading[];
}

export function useReactionValues(): ReactionValue[] {
  const enabled = useMobileButtons();
  const { data } = useQuery({
    queryKey: ['reaction-values'],
    queryFn: () => apiRequest<ReactionValue[]>('/tracks/reactions/values'),
    staleTime: VALUES_STALE_MS,
    enabled,
    retry: false,
  });
  return data ?? [];
}

function windowsAround(at: number, total: number): number[] {
  const count = Math.min(total, MAX_WINDOWS);
  const from = Math.min(Math.max(0, at - 2), total - count);
  return Array.from({ length: count }, (_, step) => from + step);
}

async function readWindow(trackUrn: string, window: number, lastSecond: number) {
  const first = window * WINDOW;
  const seconds = Array.from(
    { length: Math.min(WINDOW, lastSecond - first + 1) },
    (_, step) => first + step,
  );
  try {
    const reply = await queryClient.fetchQuery({
      queryKey: ['track', trackUrn, 'reactions', window],
      queryFn: () =>
        apiRequest<MomentsReply>(
          `/tracks/${encodeURIComponent(trackUrn)}/reactions?seconds=${seconds.join(',')}`,
        ),
      staleTime: READ_STALE_MS,
    });
    seedMoments(trackUrn, reply.moments);
  } catch (error) {
    if (error instanceof ApiError) noteReadRefusal(error);
  }
}

export function useMomentReads(trackUrn: string, durationMs: number, isCurrent: boolean) {
  const reading = useMobileReads();

  useEffect(() => {
    if (!reading || durationMs <= 0) return;
    const lastSecond = Math.floor(durationMs / 1000);
    const total = Math.floor(lastSecond / WINDOW) + 1;
    const asked = new Set<number>();
    let queue = Promise.resolve();
    let stopped = false;

    const ensure = (at: number) => {
      for (const window of windowsAround(at, total)) {
        if (asked.has(window)) continue;
        asked.add(window);
        queue = queue.then(() => (stopped ? undefined : readWindow(trackUrn, window, lastSecond)));
      }
    };

    ensure(isCurrent ? Math.floor(getCurrentTime() / WINDOW) : 0);
    const stopTicks = isCurrent
      ? subscribe(() => ensure(Math.floor(getCurrentTime() / WINDOW)))
      : undefined;
    return () => {
      stopped = true;
      stopTicks?.();
    };
  }, [reading, trackUrn, durationMs, isCurrent]);
}

export async function reactAt(trackUrn: string, second: number, valueUrn: string) {
  if (!(await guardLink())) return;
  const before = getMoment(trackUrn, second);
  const removing = before?.own === valueUrn;
  setOwnReaction(trackUrn, second, removing ? null : valueUrn);
  const path = `/tracks/${encodeURIComponent(trackUrn)}/reactions/${second}?valueUrn=${encodeURIComponent(valueUrn)}`;
  const done = await mobileWrite(removing ? 'DELETE' : 'PUT', path);
  if (!done) restoreMoment(trackUrn, second, before);
}
