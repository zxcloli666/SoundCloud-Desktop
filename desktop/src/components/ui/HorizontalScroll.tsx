import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef } from 'react';

interface HorizontalScrollProps {
  children: ReactNode;
  className?: string;
}

export function HorizontalScroll({ children, className = '' }: HorizontalScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({
    active: false,
    dragging: false,
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
  });

  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest('button, a, input, textarea, select, summary, [role="button"]') != null;

  useEffect(() => {
    return () => {
      document.body.style.removeProperty('user-select');
    };
  }, []);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isInteractiveTarget(e.target)) return;

    const el = ref.current;
    if (!el) return;

    dragStateRef.current = {
      active: true,
      dragging: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
    };

    el.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    const dragState = dragStateRef.current;
    if (!el || !dragState.active || dragState.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - dragState.startX;
    if (!dragState.dragging && Math.abs(deltaX) > 6) {
      dragState.dragging = true;
      document.body.style.userSelect = 'none';
    }

    if (!dragState.dragging) return;

    el.scrollLeft = dragState.startScrollLeft - deltaX;
    e.preventDefault();
  };

  const stopDragging = (pointerId: number) => {
    const el = ref.current;
    const dragState = dragStateRef.current;
    if (!dragState.active || dragState.pointerId !== pointerId) return;

    if (el?.hasPointerCapture(pointerId)) {
      el.releasePointerCapture(pointerId);
    }

    dragState.active = false;
    window.setTimeout(() => {
      dragState.dragging = false;
    }, 0);
    document.body.style.removeProperty('user-select');
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    stopDragging(e.pointerId);
  };

  const handlePointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    stopDragging(e.pointerId);
  };

  return (
    <div
      ref={ref}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClickCapture={(e) => {
        if (dragStateRef.current.dragging) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={`flex gap-4 overflow-x-hidden pb-2 scrollbar-hide cursor-grab active:cursor-grabbing ${className}`}
      style={{
        contentVisibility: 'auto',
        contain: 'layout paint style',
        containIntrinsicSize: '240px',
        touchAction: 'pan-y',
      }}
    >
      {children}
    </div>
  );
}
