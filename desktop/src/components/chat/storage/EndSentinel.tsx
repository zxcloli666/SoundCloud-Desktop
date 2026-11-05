import { memo, useEffect, useRef } from 'react';

export const EndSentinel = memo(function EndSentinel({
  token,
  onReach,
}: {
  token: number;
  onReach: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reach = useRef(onReach);
  reach.current = onReach;

  useEffect(() => {
    const node = ref.current;
    if (!node || token < 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) reach.current();
      },
      { root: node.closest('main'), rootMargin: '700px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [token]);

  return <div ref={ref} className="h-px w-full" aria-hidden />;
});
