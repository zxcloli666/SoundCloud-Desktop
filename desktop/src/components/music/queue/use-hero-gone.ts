import { type RefObject, useEffect, useState } from 'react';

export function useHeroGone(scrollRef: RefObject<HTMLElement | null>) {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const root = scrollRef.current;
    if (!sentinel || !root) {
      setGone(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const above = entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
        setGone(!entry.isIntersecting && above);
      },
      { root },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, scrollRef]);
  return { gone, sentinelRef: setSentinel };
}
