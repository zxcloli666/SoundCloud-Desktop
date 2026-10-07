import { type RefObject, useCallback, useEffect, useState } from 'react';

const EDGE_SLACK = 2;

export function useScrollEdges(ref: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ canPrev: false, canNext: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const canPrev = el.scrollLeft > EDGE_SLACK;
    const canNext = el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_SLACK;
    setEdges((prev) =>
      prev.canPrev === canPrev && prev.canNext === canNext ? prev : { canPrev, canNext },
    );
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    const mutation = new MutationObserver(schedule);
    mutation.observe(el, { childList: true });
    el.addEventListener('scroll', schedule, { passive: true });
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      el.removeEventListener('scroll', schedule);
    };
  }, [ref, update]);

  return { ...edges, update };
}
