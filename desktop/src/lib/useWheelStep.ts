import { type RefObject, useEffect, useRef } from 'react';

export function useWheelStep(
  ref: RefObject<HTMLElement | null>,
  step: (direction: 1 | -1, event: WheelEvent) => void,
) {
  const latest = useRef(step);

  useEffect(() => {
    latest.current = step;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY || event.deltaX;
      if (delta !== 0) latest.current(delta < 0 ? 1 : -1, event);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [ref]);
}
