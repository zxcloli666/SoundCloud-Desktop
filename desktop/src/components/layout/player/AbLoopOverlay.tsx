import React, { useRef } from 'react';
import { formatTime } from '../../../lib/formatters';
import { AB_MIN_GAP, usePlayerStore } from '../../../stores/player';

const clampPct = (v: number) => Math.max(0, Math.min(100, v));
const handleClass =
  'absolute top-1/2 z-[3] flex h-5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center';
const markClass = 'h-3.5 w-[3px] rounded-full bg-accent shadow-[0_0_8px_var(--color-accent-glow)]';

export const tipClass =
  'pointer-events-none absolute bottom-[calc(100%+7px)] z-[4] -translate-x-1/2 whitespace-nowrap rounded-md border border-ink/10 bg-surface-hi px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ink opacity-0 shadow-lg transition-opacity duration-100';

export const AbLoopOverlay = React.memo(({ duration }: { duration: number }) => {
  const abLoop = usePlayerStore((s) => s.abLoop);
  const nudgeAbBound = usePlayerStore((s) => s.nudgeAbBound);
  const bandRef = useRef<HTMLSpanElement>(null);
  const aRef = useRef<HTMLSpanElement>(null);
  const bRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  if (!abLoop || duration <= 0) return null;

  const a = abLoop.a;
  const b = abLoop.b;
  const aPct = clampPct((a / duration) * 100);
  const bPct = b != null ? clampPct((b / duration) * 100) : null;

  const startDrag = (which: 'a' | 'b') => (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const root = e.currentTarget.offsetParent as HTMLElement | null;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0) return;
    const lo = which === 'a' ? 0 : a + AB_MIN_GAP;
    const hi = which === 'a' ? (b ?? duration) - AB_MIN_GAP : duration;
    let latest = which === 'a' ? a : (b ?? a);
    const showTip = (timeSec: number, pct: number) => {
      const tip = tipRef.current;
      if (!tip) return;
      tip.textContent = formatTime(timeSec);
      tip.style.left = `${pct}%`;
      tip.style.opacity = '1';
    };
    showTip(latest, (latest / duration) * 100);
    const onMove = (ev: PointerEvent) => {
      const raw = ((ev.clientX - rect.left) / rect.width) * duration;
      latest = Math.max(lo, Math.min(hi, raw));
      const pct = (latest / duration) * 100;
      showTip(latest, pct);
      if (which === 'a') {
        if (aRef.current) aRef.current.style.left = `${pct}%`;
        if (bandRef.current && bPct != null) {
          bandRef.current.style.left = `${pct}%`;
          bandRef.current.style.width = `${Math.max(0, bPct - pct)}%`;
        }
      } else {
        if (bRef.current) bRef.current.style.left = `${pct}%`;
        if (bandRef.current) bandRef.current.style.width = `${Math.max(0, pct - aPct)}%`;
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (tipRef.current) tipRef.current.style.opacity = '0';
      nudgeAbBound(which, latest);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <>
      {bPct != null && (
        <span
          ref={bandRef}
          className="pointer-events-none absolute inset-y-0 z-[1] rounded-md bg-accent/20"
          style={{ left: `${aPct}%`, width: `${Math.max(0, bPct - aPct)}%` }}
        />
      )}
      <span
        ref={aRef}
        onPointerDown={startDrag('a')}
        className={handleClass}
        style={{ left: `${aPct}%` }}
      >
        <span className={markClass} />
      </span>
      {bPct != null && (
        <span
          ref={bRef}
          onPointerDown={startDrag('b')}
          className={handleClass}
          style={{ left: `${bPct}%` }}
        >
          <span className={markClass} />
        </span>
      )}
      <span ref={tipRef} className={tipClass} style={{ left: `${aPct}%` }} />
    </>
  );
});
