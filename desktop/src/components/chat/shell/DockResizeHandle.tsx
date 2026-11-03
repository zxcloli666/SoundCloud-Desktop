import { type KeyboardEvent, memo, type PointerEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CHAT_DOCK_DEFAULT,
  CHAT_DOCK_MAX,
  CHAT_DOCK_MIN,
  clampDockWidth,
  useChatPrefsStore,
} from '../../../stores/chat/prefs';

const KEY_STEP = 16;

interface Drag {
  startX: number;
  startWidth: number;
  width: number;
}

export const DockResizeHandle = memo(function DockResizeHandle() {
  const { t } = useTranslation();
  const width = useChatPrefsStore((state) => state.dockWidth);
  const setDockWidth = useChatPrefsStore((state) => state.setDockWidth);
  const guideRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const drag = useRef<Drag | null>(null);

  const showGuide = (offset: number, value: number) => {
    const guide = guideRef.current;
    if (guide) {
      guide.style.opacity = '1';
      guide.style.transform = `translate3d(${offset}px,0,0)`;
    }
    if (labelRef.current) labelRef.current.textContent = String(value);
  };

  const hideGuide = () => {
    const guide = guideRef.current;
    if (!guide) return;
    guide.style.opacity = '0';
    guide.style.transform = 'translate3d(0,0,0)';
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width, width };
    showGuide(0, width);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    state.width = clampDockWidth(state.startWidth + state.startX - event.clientX);
    showGuide(state.startWidth - state.width, state.width);
  };

  const onPointerUp = () => {
    const state = drag.current;
    drag.current = null;
    hideGuide();
    if (state && state.width !== state.startWidth) setDockWidth(state.width);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') setDockWidth(width + KEY_STEP);
    else if (event.key === 'ArrowRight') setDockWidth(width - KEY_STEP);
    else return;
    event.preventDefault();
  };

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('chat.list.dock.resize')}
        aria-valuemin={CHAT_DOCK_MIN}
        aria-valuemax={CHAT_DOCK_MAX}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => setDockWidth(CHAT_DOCK_DEFAULT)}
        onKeyDown={onKeyDown}
        className="group absolute inset-y-0 -left-1.5 z-30 w-3 cursor-col-resize outline-none"
      >
        <span className="absolute inset-y-0 left-1.5 w-px transition-colors duration-200 group-hover:bg-ink/25 group-focus-visible:bg-ink/40" />
      </div>
      <div
        ref={guideRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-30 w-[2px] opacity-0"
        style={{
          background: 'var(--color-accent)',
          boxShadow: '0 0 14px var(--color-accent-glow)',
          willChange: 'transform',
        }}
      >
        <span
          ref={labelRef}
          className="absolute top-3 left-2 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[10px] text-ink-85 tabular-nums"
        />
      </div>
    </>
  );
});
