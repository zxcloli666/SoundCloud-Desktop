import { type RefObject, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const RESTORE_TRIES = 20;
const MAX_SCROLL_POSITIONS = 64;

export function scrollMainToTop() {
  document.querySelector('[data-ui="main"]')?.scrollTo({ top: 0 });
}

export function ScrollReset({ target }: { target: RefObject<HTMLElement | null> }) {
  const { key, pathname } = useLocation();
  const type = useNavigationType();
  const saved = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const main = target.current;
    if (!main) return;
    const top = type === 'POP' ? (saved.current.get(key) ?? 0) : 0;
    let tries = RESTORE_TRIES;
    let frame = 0;
    const apply = () => {
      main.scrollTop = top;
      if (main.scrollTop < top - 1 && --tries > 0) frame = requestAnimationFrame(apply);
    };
    apply();
    const positions = saved.current;
    const remember = () => {
      if (!positions.has(key) && positions.size >= MAX_SCROLL_POSITIONS) {
        const oldest = positions.keys().next();
        if (!oldest.done) positions.delete(oldest.value);
      }
      positions.set(key, main.scrollTop);
    };
    main.addEventListener('scroll', remember, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      main.removeEventListener('scroll', remember);
    };
  }, [key, pathname, type, target]);

  return null;
}
