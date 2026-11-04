import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Size } from './album-layout';

export const ZOOM_MAX = 5;
const ZOOM_STEP = 1.5;
const EASE = 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)';

interface View {
  s: number;
  x: number;
  y: number;
}

interface Point {
  x: number;
  y: number;
}

interface Drag {
  pointer: number;
  startX: number;
  startY: number;
  fromX: number;
  fromY: number;
}

export interface ZoomPan {
  scale: number;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useZoomPan(
  stageRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null>,
  fit: Size,
  stage: Size,
  calm: boolean,
): ZoomPan {
  const view = useRef<View>({ s: 1, x: 0, y: 0 });
  const drag = useRef<Drag | null>(null);
  const [scale, setScale] = useState(1);

  const apply = useCallback(
    (animated: boolean) => {
      const target = targetRef.current;
      if (!target) return;
      const { s, x, y } = view.current;
      target.style.transition = animated && !calm ? EASE : 'none';
      target.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
      target.style.cursor = s > 1 ? (drag.current ? 'grabbing' : 'grab') : 'zoom-in';
    },
    [targetRef, calm],
  );

  const bound = useCallback(
    (next: View): View => {
      const maxX = Math.max(0, (fit.w * next.s - stage.w) / 2);
      const maxY = Math.max(0, (fit.h * next.s - stage.h) / 2);
      return { s: next.s, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
    },
    [fit.w, fit.h, stage.w, stage.h],
  );

  const zoomTo = useCallback(
    (next: number, point: Point, animated: boolean) => {
      const current = view.current;
      const s = clamp(next, 1, ZOOM_MAX);
      const ratio = s / current.s;
      view.current = bound({
        s,
        x: point.x - (point.x - current.x) * ratio,
        y: point.y - (point.y - current.y) * ratio,
      });
      apply(animated);
      setScale(s);
    },
    [apply, bound],
  );

  const reset = useCallback(() => {
    view.current = { s: 1, x: 0, y: 0 };
    apply(true);
    setScale(1);
  }, [apply]);

  const zoomIn = useCallback(
    () => zoomTo(view.current.s * ZOOM_STEP, { x: 0, y: 0 }, true),
    [zoomTo],
  );
  const zoomOut = useCallback(
    () => zoomTo(view.current.s / ZOOM_STEP, { x: 0, y: 0 }, true),
    [zoomTo],
  );

  useEffect(() => {
    view.current = bound(view.current);
    apply(false);
  }, [bound, apply]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const local = (event: MouseEvent): Point => {
      const rect = node.getBoundingClientRect();
      return {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      };
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = Math.exp(-clamp(event.deltaY, -120, 120) * 0.0022);
      zoomTo(view.current.s * factor, local(event), false);
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (view.current.s > 1) reset();
      else zoomTo(2.5, local(event), true);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || view.current.s <= 1) return;
      node.setPointerCapture(event.pointerId);
      drag.current = {
        pointer: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        fromX: view.current.x,
        fromY: view.current.y,
      };
      apply(false);
    };
    const onPointerMove = (event: PointerEvent) => {
      const active = drag.current;
      if (!active || active.pointer !== event.pointerId) return;
      view.current = bound({
        s: view.current.s,
        x: active.fromX + event.clientX - active.startX,
        y: active.fromY + event.clientY - active.startY,
      });
      apply(false);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (drag.current?.pointer !== event.pointerId) return;
      drag.current = null;
      if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
      apply(false);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('dblclick', onDoubleClick);
    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('pointercancel', onPointerUp);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('dblclick', onDoubleClick);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerUp);
    };
  }, [stageRef, zoomTo, reset, apply, bound]);

  return useMemo(() => ({ scale, zoomIn, zoomOut, reset }), [scale, zoomIn, zoomOut, reset]);
}
