import { type RefObject, useEffect } from 'react';

const SETTLE_MS = 120;

export function useScrollGuard(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!active || !scroller || !content) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const release = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      content.style.pointerEvents = '';
    };
    const onScroll = () => {
      content.style.pointerEvents = 'none';
      if (timer) clearTimeout(timer);
      timer = setTimeout(release, SETTLE_MS);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('pointermove', release, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      scroller.removeEventListener('pointermove', release);
      release();
    };
  }, [scrollRef, contentRef, active]);
}
