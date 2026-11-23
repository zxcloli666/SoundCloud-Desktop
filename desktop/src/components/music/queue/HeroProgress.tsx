import type React from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentTime, getDuration, seek, subscribe } from '../../../lib/audio';
import { formatTime } from '../../../lib/formatters';

export function HeroProgress({ thin = false }: { thin?: boolean }) {
  const { t } = useTranslation();
  const fillRef = useRef<HTMLSpanElement>(null);
  const nowRef = useRef<HTMLSpanElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  const dragRef = useRef<number | null>(null);

  useEffect(() => {
    const paint = () => {
      const total = getDuration();
      const at = dragRef.current ?? getCurrentTime();
      const ratio = total > 0 ? Math.min(1, Math.max(0, at / total)) : 0;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${ratio})`;
      if (nowRef.current) nowRef.current.textContent = formatTime(at);
      if (totalRef.current) totalRef.current.textContent = formatTime(total);
    };
    paint();
    return subscribe(paint);
  }, []);

  const timeAt = (event: React.PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    return ratio * getDuration();
  };

  const preview = (seconds: number) => {
    dragRef.current = seconds;
    const total = getDuration();
    if (fillRef.current && total > 0)
      fillRef.current.style.transform = `scaleX(${seconds / total})`;
    if (nowRef.current) nowRef.current.textContent = formatTime(seconds);
  };

  const bar = (
    <span
      role="slider"
      tabIndex={-1}
      aria-label={t('queue.seek')}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`group/seek relative block w-full cursor-pointer touch-none ${thin ? 'h-[3px]' : 'h-3'}`}
      onPointerDown={(event) => {
        if (event.button !== 0 || getDuration() <= 0) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        preview(timeAt(event));
      }}
      onPointerMove={(event) => {
        if (dragRef.current !== null) preview(timeAt(event));
      }}
      onPointerUp={(event) => {
        if (dragRef.current === null) return;
        seek(timeAt(event));
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <span
        className={`absolute inset-x-0 overflow-hidden rounded-full bg-ink/[0.12] ${
          thin
            ? 'inset-y-0'
            : 'top-[3.5px] h-[5px] scale-y-60 transition-transform group-hover/seek:scale-y-100'
        }`}
      >
        <span ref={fillRef} className="queue-progress-fill absolute inset-0 rounded-full" />
      </span>
    </span>
  );

  if (thin) return bar;
  return (
    <div className="flex flex-col gap-1">
      {bar}
      <div className="flex justify-between font-mono text-[11px] tabular-nums text-ink-40">
        <span ref={nowRef}>0:00</span>
        <span ref={totalRef}>0:00</span>
      </div>
    </div>
  );
}
