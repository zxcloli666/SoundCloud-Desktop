import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../../../stores/chat';

export type LoadPhase = 'loading' | 'ready' | 'failed';

export interface LoadAttempt {
  phase: LoadPhase;
  attempt: number;
  retry: () => void;
  onLoad: () => void;
  onError: () => void;
}

const BACKOFF_MS = [1500, 5000, 15000];

interface Load {
  phase: LoadPhase;
  attempt: number;
  auto: number;
}

const FIRST: Load = { phase: 'loading', attempt: 0, auto: 0 };

function again(current: Load, auto: number): Load {
  return current.phase === 'failed'
    ? { phase: 'loading', attempt: current.attempt + 1, auto }
    : current;
}

export function useLoadAttempt(stopped: boolean): LoadAttempt {
  const online = useChatStore((state) => state.status?.online ?? true);
  const [load, setLoad] = useState<Load>(FIRST);
  const wasOnline = useRef(online);

  const retry = useCallback(
    () => setLoad((current) => ({ phase: 'loading', attempt: current.attempt + 1, auto: 0 })),
    [],
  );
  const onLoad = useCallback(() => setLoad((current) => ({ ...current, phase: 'ready' })), []);
  const onError = useCallback(() => setLoad((current) => ({ ...current, phase: 'failed' })), []);

  useEffect(() => {
    const back = online && !wasOnline.current;
    wasOnline.current = online;
    if (back && !stopped) setLoad((current) => again(current, 0));
  }, [online, stopped]);

  const pending = load.phase === 'failed' && !stopped && online && load.auto < BACKOFF_MS.length;

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(
      () => setLoad((current) => again(current, current.auto + 1)),
      BACKOFF_MS[load.auto],
    );
    return () => window.clearTimeout(timer);
  }, [pending, load.auto]);

  return {
    phase: pending ? 'loading' : load.phase,
    attempt: load.attempt,
    retry,
    onLoad,
    onError,
  };
}
