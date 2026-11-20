import { memo, useLayoutEffect, useRef } from 'react';
import { clockText } from '../../lib/sync-wait';

export const WaitClock = memo(function WaitClock({
  since = 0,
  until,
  className,
}: {
  since?: number;
  until?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const paint = () => {
      node.textContent = clockText(until === undefined ? Date.now() - since : until - Date.now());
    };
    const follow = () => {
      clearInterval(timer);
      if (document.visibilityState === 'hidden') return;
      paint();
      timer = setInterval(paint, 1000);
    };
    paint();
    follow();
    document.addEventListener('visibilitychange', follow);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', follow);
    };
  }, [since, until]);

  return <span ref={ref} className={className} />;
});
