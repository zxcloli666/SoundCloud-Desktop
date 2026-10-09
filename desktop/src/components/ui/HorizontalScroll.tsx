import { type ReactNode, type PointerEvent as ReactPointerEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { useHorizontalWheel } from './useHorizontalWheel';
import { useScrollEdges } from './useScrollEdges';

interface HorizontalScrollProps {
  children: ReactNode;
  className?: string;
}

const DRAG_THRESHOLD = 6;
const PAGE_RATIO = 0.8;

interface ScrollArrowProps {
  side: 'prev' | 'next';
  visible: boolean;
  label: string;
  onClick: () => void;
}

function ScrollArrow({ side, visible, label, onClick }: ScrollArrowProps) {
  const Icon = side === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={visible ? 0 : -1}
      onClick={onClick}
      className={`absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-[0.5px] border-white/[0.12] bg-[rgba(18,18,22,0.55)] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-[var(--glass-blur-soft)] transition-all duration-300 ease-[var(--ease-apple)] hover:border-white/20 hover:bg-[rgba(28,28,34,0.75)] hover:text-white active:scale-90 ${
        side === 'prev' ? 'left-2' : 'right-2'
      } ${
        visible
          ? 'pointer-events-none opacity-0 group-hover/hscroll:pointer-events-auto group-hover/hscroll:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100'
          : 'pointer-events-none opacity-0'
      }`}
    >
      <Icon size={18} strokeWidth={2.5} />
    </button>
  );
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

  const { t } = useTranslation();
  const smooth = usePerfMode().mode !== 'light';
  const { canPrev, canNext, update } = useScrollEdges(ref);

  useHorizontalWheel(ref);

  const page = (direction: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({
      left: direction * el.clientWidth * PAGE_RATIO,
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

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
    <div className="group/hscroll relative min-w-0" onPointerEnter={update}>
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
      <ScrollArrow
        side="prev"
        visible={canPrev}
        label={t('common.scrollPrev')}
        onClick={() => page(-1)}
      />
      <ScrollArrow
        side="next"
        visible={canNext}
        label={t('common.scrollNext')}
        onClick={() => page(1)}
      />
    </div>
  );
}
