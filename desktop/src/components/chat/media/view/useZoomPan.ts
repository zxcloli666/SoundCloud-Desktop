import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
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
  scale: () => number;
  subscribe: (listener: () => void) => () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

const FLAT: View = { s: 1, x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function onControl(event: Event): boolean {
  return event.target instanceof Element && event.target.closest('button') !== null;
}

function still() {
  return () => undefined;
}

export function useZoomScale(zoom: ZoomPan | null): number {
  return useSyncExternalStore(zoom?.subscribe ?? still, () =>
    zoom ? Math.round(zoom.scale() * 100) / 100 : 1,
  );
}

function useScaleFeed() {
  const listeners = useRef(new Set<() => void>());
  const frame = useRef(0);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const subscribe = useCallback((listener: () => void) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  const publish = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      for (const listener of listeners.current) listener();
    });
  }, []);

  return { subscribe, publish };
}

export function useZoomPan(
  stageRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null>,
  fit: Size,
  stage: Size,
  calm: boolean,
  enabled: boolean,
): ZoomPan {
  const view = useRef<View>(FLAT);
  const drag = useRef<Drag | null>(null);
  const { subscribe, publish } = useScaleFeed();

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
      publish();
    },
    [apply, bound, publish],
  );

  const reset = useCallback(() => {
    view.current = FLAT;
    apply(true);
    publish();
  }, [apply, publish]);

  const zoomIn = useCallback(
    () => zoomTo(view.current.s * ZOOM_STEP, { x: 0, y: 0 }, true),
    [zoomTo],
  );
  const zoomOut = useCallback(
    () => zoomTo(view.current.s / ZOOM_STEP, { x: 0, y: 0 }, true),
    [zoomTo],
  );
  const scale = useCallback(() => view.current.s, []);

  useEffect(() => {
    view.current = bound(view.current);
    apply(false);
  }, [bound, apply]);

  useEffect(() => {
    if (enabled) return;
    view.current = FLAT;
    drag.current = null;
    publish();
  }, [enabled, publish]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node || !enabled) return;
    const local = (event: MouseEvent): Point => {
      const rect = node.getBoundingClientRect();
      return {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      };
    };
    const endDrag = (pointer: number) => {
      if (drag.current?.pointer !== pointer) return;
      drag.current = null;
      if (node.hasPointerCapture(pointer)) node.releasePointerCapture(pointer);
      apply(false);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const factor = Math.exp(-clamp(event.deltaY, -120, 120) * 0.0022);
      zoomTo(view.current.s * factor, local(event), false);
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (onControl(event)) return;
      if (view.current.s > 1) reset();
      else zoomTo(2.5, local(event), true);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || view.current.s <= 1 || onControl(event)) return;
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
      if (event.buttons === 0) {
        endDrag(event.pointerId);
        return;
      }
      view.current = bound({
        s: view.current.s,
        x: active.fromX + event.clientX - active.startX,
        y: active.fromY + event.clientY - active.startY,
      });
      apply(false);
    };
    const onPointerEnd = (event: PointerEvent) => endDrag(event.pointerId);
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('dblclick', onDoubleClick);
    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', onPointerEnd);
    node.addEventListener('pointercancel', onPointerEnd);
    node.addEventListener('lostpointercapture', onPointerEnd);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('dblclick', onDoubleClick);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerEnd);
      node.removeEventListener('pointercancel', onPointerEnd);
      node.removeEventListener('lostpointercapture', onPointerEnd);
    };
  }, [stageRef, zoomTo, reset, apply, bound, enabled]);

  return useMemo(
    () => ({ scale, subscribe, zoomIn, zoomOut, reset }),
    [scale, subscribe, zoomIn, zoomOut, reset],
  );
}
