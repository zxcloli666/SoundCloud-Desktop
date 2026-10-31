import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type Aura, auraRgba } from '../../lib/aura';
import {fc} from '../../lib/formatters';
import {usePerfMode} from '../../lib/perf';

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
  aura: Aura;
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function TabDockImpl<T extends string>({ tabs, active, onChange, aura }: TabDockProps<T>) {
    const perf = usePerfMode();
    const dockB = perf.blur(40);
  const dockRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const [overflows, setOverflows] = useState(false);
  const dragRef = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

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
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(dock);
    ro.observe(btn);
    return () => ro.disconnect();
  }, [active, tabs]);

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
    <div className="sticky top-3 z-40 flex justify-center pointer-events-none px-2 sm:px-4">
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
        className={`pointer-events-auto relative flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 rounded-2xl min-w-0 max-w-full overflow-x-auto overscroll-x-contain touch-pan-x select-none [&::-webkit-scrollbar]:hidden [scrollbar-width:none] ${
          overflows ? 'cursor-grab' : 'cursor-default'
        }`}
        style={{
            background: dockB > 0 ? 'rgb(var(--surface) / 0.55)' : 'rgb(var(--surface) / 0.92)',
            backdropFilter: dockB > 0 ? `blur(${dockB}px) saturate(180%)` : undefined,
            WebkitBackdropFilter: dockB > 0 ? `blur(${dockB}px) saturate(180%)` : undefined,
          boxShadow:
            '0 24px 60px rgb(var(--shade) / calc(0.45 * var(--shade-alpha))), inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {pill && (
          <div
            className="absolute top-1 bottom-1 sm:top-1.5 sm:bottom-1.5 rounded-xl transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{
              left: pill.x,
              width: pill.w,
              background: `linear-gradient(180deg, ${auraRgba(aura, 0.22)}, ${auraRgba(aura, 0.06)})`,
              border: `0.5px solid ${auraRgba(aura, 0.35)}`,
              boxShadow: `0 6px 20px ${auraRgba(aura, 0.25)}, inset 0 0.5px 0 rgba(255,255,255,0.12)`,
            }}
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
                    color: isActive ? 'rgb(var(--ink))' : 'rgb(var(--ink) / calc(0.35 * (1 + var(--ink-lift) * (1 - 0.35))))',
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
  );
}

export const TabDock = React.memo(TabDockImpl) as typeof TabDockImpl;
