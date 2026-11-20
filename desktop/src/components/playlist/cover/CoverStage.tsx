import React, { useEffect, useLayoutEffect, useRef } from 'react';
import {
  type CoverFrame,
  type CoverSize,
  panFrame,
  zoomFrame,
  zoomOf,
} from '../../../lib/cover-crop';
import type { CoverSource } from '../../../lib/playlist-artwork';

const KEY_STEP = 0.04;
const WHEEL_RATE = 0.0015;
const ZOOM_STEP = 1.1;

const PAN: Record<string, [number, number]> = {
  ArrowLeft: [1, 0],
  ArrowRight: [-1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

function paint(img: HTMLImageElement | null, frame: CoverFrame, size: CoverSize, viewport: number) {
  if (!img || viewport === 0) return;
  const scale = viewport / frame.side;
  const left = (frame.x - frame.side / 2) * scale;
  const top = (frame.y - frame.side / 2) * scale;
  img.style.transform = `translate3d(${-left}px, ${-top}px, 0) scale(${zoomOf(frame, size)})`;
}

export const CoverStage = React.memo(function CoverStage({
  source,
  frame,
  label,
  onFrame,
  onSubmit,
}: {
  source: CoverSource;
  frame: CoverFrame;
  label: string;
  onFrame: (frame: CoverFrame) => void;
  onSubmit: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const live = useRef(frame);
  const grab = useRef<{ id: number; x: number; y: number } | null>(null);
  const report = useRef(onFrame);
  report.current = onFrame;

  const viewport = () => stage.current?.clientWidth ?? 0;
  const show = (next: CoverFrame) => {
    live.current = next;
    paint(img.current, next, source.size, viewport());
  };
  const commit = (next: CoverFrame) => {
    show(next);
    report.current(next);
  };

  useLayoutEffect(() => {
    live.current = frame;
    paint(img.current, frame, source.size, stage.current?.clientWidth ?? 0);
  }, [frame, source.size]);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoom = zoomOf(live.current, source.size) * Math.exp(-event.deltaY * WHEEL_RATE);
      const next = zoomFrame(live.current, zoom, source.size);
      live.current = next;
      paint(img.current, next, source.size, node.clientWidth);
      report.current(next);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [source.size]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.moving = '';
    grab.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = grab.current;
    if (!held || held.id !== event.pointerId) return;
    show(
      panFrame(
        live.current,
        event.clientX - held.x,
        event.clientY - held.y,
        viewport(),
        source.size,
      ),
    );
    grab.current = { ...held, x: event.clientX, y: event.clientY };
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (grab.current?.id !== event.pointerId) return;
    grab.current = null;
    delete event.currentTarget.dataset.moving;
    report.current(live.current);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const pan = PAN[event.key];
    if (pan) {
      event.preventDefault();
      const step = viewport() * KEY_STEP * (event.shiftKey ? 4 : 1);
      commit(panFrame(live.current, pan[0] * step, pan[1] * step, viewport(), source.size));
      return;
    }
    const zoom =
      event.key === '+' || event.key === '=' ? ZOOM_STEP : event.key === '-' ? 1 / ZOOM_STEP : 0;
    if (zoom) {
      event.preventDefault();
      commit(zoomFrame(live.current, zoomOf(live.current, source.size) * zoom, source.size));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div
      ref={stage}
      data-ui="playlist-cover-crop"
      role="group"
      tabIndex={0}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      className="group/stage relative aspect-square w-[min(300px,72vw)] overflow-hidden rounded-[1.7rem] cursor-grab data-[moving]:cursor-grabbing touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      style={{
        background: 'rgb(var(--ink) / 0.05)',
        boxShadow:
          '0 24px 50px rgb(var(--shade) / calc(0.5 * var(--shade-alpha))), inset 0 0 0 0.5px rgb(var(--ink) / 0.12)',
      }}
    >
      <img
        ref={img}
        src={source.url}
        alt=""
        draggable={false}
        className="absolute left-0 top-0 max-w-none origin-top-left will-change-transform"
        style={{
          width: `${(source.size.width / Math.min(source.size.width, source.size.height)) * 100}%`,
          height: `${(source.size.height / Math.min(source.size.width, source.size.height)) * 100}%`,
        }}
      />
      <div
        aria-hidden
        data-scheme="dark"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-data-[moving]/stage:opacity-100 motion-reduce:transition-none"
      >
        <span className="absolute inset-y-0 left-1/3 right-1/3 border-x border-ink/40" />
        <span className="absolute inset-x-0 top-1/3 bottom-1/3 border-y border-ink/40" />
      </div>
    </div>
  );
});
