import { type RefObject, useEffect } from 'react';

const LINE_HEIGHT = 16;

function wheelDelta(e: WheelEvent, size: number) {
  const scale = e.deltaMode === 1 ? LINE_HEIGHT : e.deltaMode === 2 ? size : 1;
  const x = e.deltaX === 0 && e.shiftKey ? e.deltaY : e.deltaX;
  const y = e.deltaX === 0 && e.shiftKey ? 0 : e.deltaY;
  return { x: x * scale, y: y * scale };
}

export function useHorizontalWheel(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const { x, y } = wheelDelta(e, el.clientWidth);
      if (x === 0 || Math.abs(x) <= Math.abs(y)) return;

      if (el.scrollWidth <= el.clientWidth) return;

      e.preventDefault();
      el.scrollLeft += x;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref]);
}
