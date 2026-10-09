import { type RefObject, useLayoutEffect, useState } from 'react';

export function useMainScroll(containerRef: RefObject<HTMLElement | null>) {
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const main = container?.closest('main');
    if (!container || !main) return;

    const measure = () => {
      const offset =
        container.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
      setScrollMargin((prev) => (Math.abs(prev - offset) < 1 ? prev : Math.round(offset)));
    };

    setScrollElement(main);
    measure();

    const observer = new ResizeObserver(measure);
    for (let node = container.parentElement; node && node !== main; node = node.parentElement) {
      observer.observe(node);
    }
    return () => observer.disconnect();
  }, [containerRef]);

  return { scrollElement, scrollMargin };
}
