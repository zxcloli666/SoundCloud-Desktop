import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fc } from '../../lib/formatters';
import { useScrollEdges } from '../ui/useScrollEdges';

export type TabId = 'popular' | 'tracks' | 'playlists' | 'likes' | 'followers' | 'following';

export interface TabDescriptor<T extends string = string> {
  id: T;
  label: string;
  count?: number | null;
}

interface TabDockProps<T extends string = string> {
  tabs: ReadonlyArray<TabDescriptor<T>>;
  active: T;
  onChange: (id: T) => void;
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function edgeFade(start: boolean, end: boolean) {
  if (!start && !end) return undefined;
  const from = start ? 'transparent, rgb(var(--ink)) 28px' : 'rgb(var(--ink))';
  const to = end ? 'rgb(var(--ink)) calc(100% - 28px), transparent' : 'rgb(var(--ink))';
  return `linear-gradient(90deg, ${from}, ${to})`;
}

function TabDockImpl<T extends string>({ tabs, active, onChange }: TabDockProps<T>) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const [overflows, setOverflows] = useState(false);
  const dragRef = useRef({ active: false, startX: 0, startScroll: 0, moved: false });
  const { canPrev, canNext, update: updateEdges } = useScrollEdges(dockRef);
  const fade = edgeFade(canPrev, canNext);

  useIsoLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const btn = dock.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`);
    if (!btn) return;

    const update = () => {
      const dockRect = dock.getBoundingClientRect();
      const r = btn.getBoundingClientRect();
      setPill({ x: r.left - dockRect.left + dock.scrollLeft, w: r.width });
      setOverflows(dock.scrollWidth > dock.clientWidth + 1);
      updateEdges();
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(dock);
    ro.observe(btn);
    return () => ro.disconnect();
  }, [active, tabs, updateEdges]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const dock = dockRef.current;
    if (!dock || dock.scrollWidth <= dock.clientWidth + 1) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startScroll: dock.scrollLeft,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    const dock = dockRef.current;
    if (!dock) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > 5) {
      drag.moved = true;
      dock.setPointerCapture(e.pointerId);
      dock.style.cursor = 'grabbing';
    }
    if (drag.moved) {
      dock.scrollLeft = drag.startScroll - dx;
    }
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;
    drag.moved = false;
    const dock = dockRef.current;
    if (!dock) return;
    if (dock.hasPointerCapture(e.pointerId)) dock.releasePointerCapture(e.pointerId);
    dock.style.cursor = '';
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const dock = dockRef.current;
    if (!dock) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    dock.scrollLeft += e.deltaY;
  }, []);

  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isHovered) return;
      if (dock.scrollWidth <= dock.clientWidth + 1) return;

      if (e.key === 'PageUp') {
        dock.scrollBy({ left: -dock.clientWidth * 0.8, behavior: 'smooth' });
        e.preventDefault();
      } else if (e.key === 'PageDown') {
        dock.scrollBy({ left: dock.clientWidth * 0.8, behavior: 'smooth' });
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isHovered]);

  return (
    <div className="sticky top-3 z-40 flex justify-center pointer-events-none px-2 sm:px-4 min-w-0">
      <div
        className="pointer-events-auto flex min-w-0 max-w-full rounded-2xl border border-ink/[0.08] bg-[var(--shell)]"
      >
        <div
          ref={dockRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
          onWheel={onWheel}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`relative flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 rounded-2xl min-w-0 overflow-x-auto overscroll-x-contain touch-pan-x select-none [&::-webkit-scrollbar]:hidden [scrollbar-width:none] ${
            overflows ? 'cursor-grab' : 'cursor-default'
          }`}
          style={{ maskImage: fade, WebkitMaskImage: fade }}
        >
          {pill && (
            <div
              className="absolute top-1 bottom-1 rounded-xl bg-ink/[0.09] transition-all duration-300 sm:top-1.5 sm:bottom-1.5"
              style={{ left: pill.x, width: pill.w }}
            />
          )}
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-tab={tab.id}
                data-ui="tab"
                data-active={isActive}
                onClick={() => onChange(tab.id)}
                className={`relative z-10 shrink-0 inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 md:px-4 h-8 sm:h-9 rounded-xl text-[12px] sm:text-[12.5px] font-semibold transition-colors duration-300 ${
                  overflows ? 'cursor-grab' : 'cursor-pointer'
                } ${isActive ? 'text-ink' : 'text-ink-45 hover:text-ink-85'}`}
              >
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.count != null && (
                  <span
                    className="hidden sm:inline-flex text-[10px] tabular-nums font-bold px-1.5 py-0.5 rounded-md transition-colors"
                    style={{
                      background: isActive ? 'rgb(var(--ink) / 0.16)' : 'rgb(var(--ink) / 0.05)',
                      color: isActive
                        ? 'rgb(var(--ink))'
                        : 'rgb(var(--ink) / calc(0.35 * (1 + var(--ink-lift) * (1 - 0.35))))',
                    }}
                  >
                    {fc(tab.count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const TabDock = React.memo(TabDockImpl) as typeof TabDockImpl;
