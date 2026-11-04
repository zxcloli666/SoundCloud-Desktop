import { type RefObject, useEffect, useState } from 'react';
import { lineChars } from './rows';

const ROW_MAX_PX = 780;
const ROW_GUTTER_PX = 24;

export function useLineChars(scrollRef: RefObject<HTMLDivElement | null>): number {
  const [perLine, setPerLine] = useState(() => lineChars(360));

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () =>
      setPerLine(lineChars(Math.min(element.clientWidth, ROW_MAX_PX) - ROW_GUTTER_PX));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRef]);

  return perLine;
}
