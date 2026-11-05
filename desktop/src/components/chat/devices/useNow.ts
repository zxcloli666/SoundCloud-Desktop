import { useEffect, useState } from 'react';

export function useNow(stepMs: number, active = true): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      if (document.visibilityState !== 'visible') return;
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), stepMs);
    };
    start();
    document.addEventListener('visibilitychange', start);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', start);
    };
  }, [stepMs, active]);

  return now;
}
