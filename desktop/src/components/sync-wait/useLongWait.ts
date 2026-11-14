import { useEffect, useReducer, useState } from 'react';
import { longWaitLeft, type WaitKind } from '../../lib/sync-wait';

export function useLongWait(kind: WaitKind, since: number) {
  const [seen] = useState(Date.now);
  const [, wake] = useReducer((n: number) => n + 1, 0);
  const from = Number.isNaN(since) ? seen : since;

  useEffect(() => {
    const left = longWaitLeft(kind, from, Date.now());
    if (left <= 0) return;
    const timer = setTimeout(wake, left);
    return () => clearTimeout(timer);
  }, [kind, from]);

  return { long: longWaitLeft(kind, from, Date.now()) <= 0, from };
}
