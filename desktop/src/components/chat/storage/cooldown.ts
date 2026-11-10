import { useEffect, useState } from 'react';
import type { ChatError } from '../../../lib/chat/types';
import { isRateLimit } from './error-text';

const LIMIT_PAUSE_MS = 10000;

export function useCooldown(error: ChatError | null): number {
  const pause = isRateLimit(error) ? error?.retryMs || LIMIT_PAUSE_MS : 0;
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const next = error && pause > 0 ? Date.now() + pause : 0;
    setUntil(next);
    setNow(Date.now());
  }, [error, pause]);

  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= until) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [until]);

  return Math.max(0, Math.ceil((until - now) / 1000));
}
