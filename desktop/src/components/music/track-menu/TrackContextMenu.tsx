import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { usePerfMode } from '../../../lib/perf';
import { type TrackMenuTarget, useTrackMenuStore } from '../../../stores/trackMenu';
import { AddToPlaylistDialog } from '../AddToPlaylistDialog';
import { TrackMenuHeader } from './TrackMenuHeader';
import { TrackMenuItems } from './TrackMenuItems';

const EDGE = 8;

interface Placement {
  left: number;
  top: number;
  origin: string;
}

function place(x: number, y: number, w: number, h: number): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const flipX = x + w + EDGE > vw;
  const flipY = y + h + EDGE > vh;
  return {
    left: Math.max(EDGE, Math.min(flipX ? x - w : x, vw - w - EDGE)),
    top: Math.max(EDGE, Math.min(flipY ? y - h : y, vh - h - EDGE)),
    origin: `${flipX ? 'right' : 'left'} ${flipY ? 'bottom' : 'top'}`,
  };
}

function focusSibling(root: HTMLElement, step: 1 | -1 | 'first' | 'last') {
  const items = Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  if (items.length === 0) return;
  const current = items.indexOf(document.activeElement as HTMLElement);
  const next =
    step === 'first'
      ? 0
      : step === 'last'
        ? items.length - 1
        : current < 0
          ? step === 1
            ? 0
            : items.length - 1
          : (current + step + items.length) % items.length;
  items[next].focus({ preventScroll: true });
}

function MenuPanel({ target }: { target: TrackMenuTarget }) {
  const { t } = useTranslation();
  const blur = usePerfMode().blur(24);
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setPlacement(place(target.x, target.y, el.offsetWidth, el.offsetHeight));
  }, [target.x, target.y]);

  useEffect(() => {
    if (!placement) return;
    ref.current?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => setShown(true));
    const fallback = setTimeout(() => setShown(true), 80);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fallback);
    };
  }, [placement]);

  useEffect(() => {
    const close = useTrackMenuStore.getState().close;
    const outside = (e: Event) => !ref.current?.contains(e.target as Node);
    const onPointerDown = (e: PointerEvent) => {
      if (outside(e)) close();
    };
    const onScroll = (e: Event) => {
      if (outside(e)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const root = ref.current;
      if (!root) return;
      e.stopPropagation();
      if (e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusSibling(root, 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusSibling(root, -1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        focusSibling(root, 'first');
      } else if (e.key === 'End') {
        e.preventDefault();
        focusSibling(root, 'last');
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const active = document.activeElement;
        if (active instanceof HTMLElement && root.contains(active) && active !== root) {
          active.click();
        }
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, []);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={t('trackMenu.menuLabel')}
      tabIndex={-1}
      data-state={shown ? 'open' : 'closed'}
      onContextMenu={(e) => e.preventDefault()}
      className="track-menu fixed z-[100] w-[264px] overflow-y-auto overflow-x-hidden rounded-2xl p-1.5 outline-none select-none"
      style={{
        left: placement?.left ?? 0,
        top: placement?.top ?? 0,
        visibility: placement ? 'visible' : 'hidden',
        transformOrigin: placement?.origin,
        maxHeight: `calc(100vh - ${EDGE * 2}px)`,
        border: '0.5px solid rgba(255,255,255,0.12)',
        background:
          blur > 0
            ? 'linear-gradient(168deg, rgba(30,29,36,0.82), rgba(12,11,15,0.9))'
            : 'linear-gradient(168deg, rgba(28,27,34,0.98), rgba(12,11,15,0.99))',
        backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.6)` : undefined,
        WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.6)` : undefined,
        boxShadow:
          '0 24px 64px rgba(0,0,0,0.55), 0 0 48px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
        }}
      />
      <TrackMenuHeader track={target.track} />
      <div className="mx-2 mb-1 h-px bg-white/[0.06]" />
      <TrackMenuItems target={target} />
    </div>,
    document.body,
  );
}

function PlaylistDialogHost() {
  const urn = useTrackMenuStore((s) => s.playlistTrackUrn);
  const open = useTrackMenuStore((s) => s.playlistOpen);
  const trackUrns = useMemo(() => (urn ? [urn] : []), [urn]);

  if (!urn) return null;
  return (
    <AddToPlaylistDialog
      trackUrns={trackUrns}
      open={open}
      onOpenChange={(next) => {
        if (!next) useTrackMenuStore.getState().closePlaylistDialog();
      }}
    />
  );
}

export function TrackContextMenu() {
  const target = useTrackMenuStore((s) => s.target);
  return (
    <>
      {target && <MenuPanel key={`${target.track.urn}:${target.x}:${target.y}`} target={target} />}
      <PlaylistDialogHost />
    </>
  );
}
