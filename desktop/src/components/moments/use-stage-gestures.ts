import { type RefObject, useEffect } from 'react';

const WHEEL_STEP = 60;
const WHEEL_QUIET_MS = 220;
const WHEEL_MIN_LOCK_MS = 380;
const DRAG_START_PX = 8;
const DRAG_COMMIT_PX = 90;
const DRAG_FLICK_SPEED = 0.6;

const KEYS: Record<string, 1 | -1 | 'toggle'> = {
  ArrowDown: 1,
  PageDown: 1,
  KeyJ: 1,
  ArrowUp: -1,
  PageUp: -1,
  Space: 'toggle',
  KeyK: 'toggle',
};

export function useStageGestures(
  stageRef: RefObject<HTMLDivElement | null>,
  cardRef: RefObject<HTMLDivElement | null>,
  go: (delta: 1 | -1) => unknown,
  toggle: () => void,
) {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let wheelSum = 0;
    let lastWheel = 0;
    let lockedUntil = 0;
    let holding = false;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      const quiet = now - lastWheel > WHEEL_QUIET_MS;
      lastWheel = now;
      if (holding) {
        if (!quiet || now < lockedUntil) return;
        holding = false;
      }
      if (quiet) wheelSum = 0;
      wheelSum += Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : 0;
      if (Math.abs(wheelSum) < WHEEL_STEP) return;
      go(wheelSum > 0 ? 1 : -1);
      wheelSum = 0;
      holding = true;
      lockedUntil = now + WHEEL_MIN_LOCK_MS;
    };

    let pointer: number | null = null;
    let startY = 0;
    let startAt = 0;
    let dy = 0;
    let dragging = false;
    let swallowClick = false;

    const paint = (offset: number, settle: boolean) => {
      const card = cardRef.current;
      if (!card) return;
      card.style.transition = settle
        ? 'transform 260ms var(--ease-apple), opacity 260ms ease'
        : 'none';
      card.style.transform = offset ? `translate3d(0, ${offset}px, 0)` : '';
      card.style.opacity = offset ? String(1 - Math.min(0.5, Math.abs(offset) / 600)) : '';
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('a,input,[data-no-drag]')) return;
      pointer = e.pointerId;
      startY = e.clientY;
      startAt = performance.now();
      dy = 0;
      dragging = false;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      dy = e.clientY - startY;
      if (!dragging && Math.abs(dy) > DRAG_START_PX) {
        dragging = true;
        stage.setPointerCapture(e.pointerId);
      }
      if (dragging) paint(dy * 0.55, false);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      if (!dragging) return;
      dragging = false;
      swallowClick = true;
      paint(0, true);
      const speed = Math.abs(dy) / Math.max(1, performance.now() - startAt);
      if (Math.abs(dy) > DRAG_COMMIT_PX || speed > DRAG_FLICK_SPEED) go(dy < 0 ? 1 : -1);
    };

    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const action = KEYS[e.code];
      if (action === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      if (action === 'toggle') {
        if (!e.repeat) toggle();
      } else {
        go(action);
      }
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [stageRef, cardRef, go, toggle]);
}

export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  return !!el.closest(
    'input,textarea,select,[contenteditable="true"],[role="dialog"],[role="menu"]',
  );
}
