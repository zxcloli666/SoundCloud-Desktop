import { useLayoutEffect, useState } from 'react';

export function useDockInset(docked: boolean): number {
  const [inset, setInset] = useState(0);
  useLayoutEffect(() => {
    const bar = docked ? document.querySelector<HTMLElement>('[data-ui="player"]') : null;
    const dock = bar?.querySelector<HTMLElement>('.npb-dock');
    if (!bar || !dock) {
      setInset(0);
      return;
    }
    const measure = () => setInset(bar.offsetHeight - dock.offsetTop);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    observer.observe(dock);
    return () => observer.disconnect();
  }, [docked]);
  return inset;
}
