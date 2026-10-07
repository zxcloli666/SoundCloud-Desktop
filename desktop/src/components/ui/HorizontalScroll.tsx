import { type ReactNode, type PointerEvent as ReactPointerEvent, useEffect, useRef } from 'react';
import { useHorizontalWheel } from './useHorizontalWheel';

interface HorizontalScrollProps {
  children: ReactNode;
  className?: string;
}

const DRAG_THRESHOLD = 6;

export function HorizontalScroll({ children, className = '' }: HorizontalScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({
    active: false,
    dragging: false,
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
  });

  useHorizontalWheel(ref);

  useEffect(() => {
    return () => {
      document.body.style.removeProperty('user-select');
    };
  }, []);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = ref.current;
    if (!el) return;

    dragStateRef.current = {
      active: true,
      dragging: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
    };
    document.body.style.userSelect = 'none';
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    const drag = dragStateRef.current;
    if (!el || !drag.active || drag.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - drag.startX;
    if (!drag.dragging && Math.abs(deltaX) > DRAG_THRESHOLD) {
      drag.dragging = true;
      el.setPointerCapture(drag.pointerId);
    }

    if (!drag.dragging) return;
    el.scrollLeft = drag.startScrollLeft - deltaX;
    e.preventDefault();
  };

  const stopDragging = (pointerId: number) => {
    const el = ref.current;
    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== pointerId) return;

    if (el?.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);

    drag.active = false;
    window.setTimeout(() => {
      drag.dragging = false;
    }, 0);
    document.body.style.removeProperty('user-select');
  };

  return (
    <div
      ref={ref}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => stopDragging(e.pointerId)}
      onPointerCancel={(e) => stopDragging(e.pointerId)}
      onClickCapture={(e) => {
        if (dragStateRef.current.dragging) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={`flex gap-4 overflow-x-hidden pb-2 scrollbar-hide cursor-grab active:cursor-grabbing ${className}`}
      style={{
        contain: 'layout paint style',
        touchAction: 'pan-y',
      }}
    >
      {children}
    </div>
  );
}
