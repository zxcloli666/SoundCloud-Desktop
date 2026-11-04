import { memo, type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePerfMode } from '../../../../lib/perf';
import { ChevronLeft, ChevronRight, LoaderCircle } from './icons';
import { LightboxBar } from './LightboxBar';
import { LightboxStage } from './LightboxStage';
import { LightboxStrip } from './LightboxStrip';
import {
  closeLightbox,
  jumpFromLightbox,
  type LightboxSession,
  pickLightbox,
  stepLightbox,
} from './lightbox-store';
import { useCalmMotion } from './motion';
import { viewUrl, warmUrl } from './urls';
import type { ZoomPan } from './useZoomPan';

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function trapTab(dialog: HTMLElement, event: KeyboardEvent) {
  const nodes = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (nodes.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const inside = dialog.contains(document.activeElement);
  if (
    event.shiftKey &&
    (!inside || document.activeElement === first || document.activeElement === dialog)
  ) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
    event.preventDefault();
    first.focus();
  }
}

function SideButton({
  side,
  label,
  onClick,
  children,
}: {
  side: 'left' | 'right';
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`absolute top-1/2 z-10 flex size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-surface/70 text-ink-85 ring-1 ring-ink/10 transition-[background-color,transform] duration-150 hover:scale-105 hover:bg-surface/90 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${
        side === 'left' ? 'left-4' : 'right-4'
      }`}
    >
      {children}
    </button>
  );
}

export const LightboxView = memo(function LightboxView({ session }: { session: LightboxSession }) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const calm = useCalmMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomPan | null>(null);
  const zoomRef = useRef<ZoomPan | null>(null);
  zoomRef.current = zoom;
  const { items, index } = session;
  const image = items[index];
  const hasPrev = index > 0 || session.more;
  const hasNext = index < items.length - 1;
  const blur = perf.blur(18);

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    for (const near of [items[index - 1], items[index + 1]]) {
      if (near) warmUrl(viewUrl(near.conversationId, near.mediaId, 'thumb'));
    }
  }, [items, index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const zoomNow = zoomRef.current;
      let handled = true;
      if (event.key === 'Escape') {
        if (zoomNow && zoomNow.scale > 1) zoomNow.reset();
        else closeLightbox();
      } else if (event.key === 'ArrowLeft') void stepLightbox(-1);
      else if (event.key === 'ArrowRight') void stepLightbox(1);
      else if (event.key === '+' || event.key === '=') zoomNow?.zoomIn();
      else if (event.key === '-' || event.key === '_') zoomNow?.zoomOut();
      else if (event.key === '0') zoomNow?.reset();
      else if (event.key === 'Tab') trapTab(dialog, event);
      else handled = false;
      if (!handled) return;
      if (event.key !== 'Tab') event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  if (!image) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('chat.gallery.viewer.label')}
      tabIndex={-1}
      data-ui="chat-lightbox"
      data-scheme="dark"
      className="chat-media-motion fixed inset-0 z-[1000] flex flex-col text-ink outline-none"
      style={{ animation: calm ? undefined : 'chat-media-fade 180ms ease-out' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          contain: 'strict',
          transform: blur > 0 ? 'translateZ(0)' : undefined,
          background: blur > 0 ? 'rgb(var(--paper) / 0.9)' : 'rgb(var(--paper) / 0.97)',
          backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.2)` : undefined,
          WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.2)` : undefined,
        }}
      />
      <LightboxBar
        session={session}
        image={image}
        zoom={zoom}
        onClose={closeLightbox}
        onJump={jumpFromLightbox}
      />
      <div className="relative flex min-h-0 flex-1" style={{ isolation: 'isolate' }}>
        <LightboxStage
          key={`${image.clientId}:${image.mediaId}`}
          image={image}
          onZoom={setZoom}
          onBackdrop={closeLightbox}
        />
        {hasPrev && (
          <SideButton
            side="left"
            label={t('chat.gallery.viewer.prev')}
            onClick={() => void stepLightbox(-1)}
          >
            {session.loadingOlder ? (
              <LoaderCircle
                size={20}
                className="chat-media-motion"
                style={{ animation: calm ? undefined : 'chat-media-spin 0.9s linear infinite' }}
              />
            ) : (
              <ChevronLeft size={22} />
            )}
          </SideButton>
        )}
        {hasNext && (
          <SideButton
            side="right"
            label={t('chat.gallery.viewer.next')}
            onClick={() => void stepLightbox(1)}
          >
            <ChevronRight size={22} />
          </SideButton>
        )}
      </div>
      <LightboxStrip items={items} index={index} onPick={pickLightbox} />
    </div>
  );
});
