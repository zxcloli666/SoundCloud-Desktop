import { type RefObject, useEffect } from 'react';

const EDGE = 2;
const PEEK = 52;

function markEdges(row: HTMLElement) {
  const end = row.scrollWidth - row.clientWidth;
  row.toggleAttribute('data-before', row.scrollLeft > EDGE);
  row.toggleAttribute('data-after', row.scrollLeft < end - EDGE);
}

export function useChipScroller(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (row.scrollWidth <= row.clientWidth) return;
      event.preventDefault();
      row.scrollLeft += event.deltaY;
    };
    const onScroll = () => markEdges(row);
    const observer = new ResizeObserver(onScroll);
    observer.observe(row);
    markEdges(row);
    row.addEventListener('wheel', onWheel, { passive: false });
    row.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      row.removeEventListener('wheel', onWheel);
      row.removeEventListener('scroll', onScroll);
    };
  }, [ref]);
}

export function revealChip(row: HTMLElement | null, smooth: boolean) {
  const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (!row || !chip) return;
  const start = chip.offsetLeft - PEEK;
  const end = chip.offsetLeft + chip.offsetWidth + PEEK - row.clientWidth;
  const left = row.scrollLeft > start ? start : row.scrollLeft < end ? end : null;
  if (left === null) return;
  row.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'instant' });
}
