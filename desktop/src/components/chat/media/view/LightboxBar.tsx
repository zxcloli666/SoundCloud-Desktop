import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { senderColor } from '../../../../lib/chat/render';
import { fullTime } from '../../../../lib/chat/time';
import { WindowControls } from '../../../layout/Titlebar';
import { MessageSquareShare, X, ZoomIn, ZoomOut } from './icons';
import type { ViewImage } from './images';
import type { LightboxSession } from './lightbox-store';
import { ZOOM_MAX, type ZoomPan, useZoomScale } from './useZoomPan';

function BarButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 cursor-pointer items-center justify-center rounded-full text-ink-75 transition-colors duration-150 hover:bg-ink/[0.1] hover:text-ink-95 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

export const LightboxBar = memo(function LightboxBar({
  session,
  image,
  zoom,
  onClose,
  onJump,
}: {
  session: LightboxSession;
  image: ViewImage;
  zoom: ZoomPan | null;
  onClose: () => void;
  onJump: () => void;
}) {
  const { t, i18n } = useTranslation();
  const scale = useZoomScale(zoom);
  const canJump = session.onJump !== null && image.seq !== null;
  return (
    <header
      data-tauri-drag-region
      className="relative z-10 flex h-14 shrink-0 items-center gap-3 pr-3 pl-4"
    >
      <div data-tauri-drag-region className="flex min-w-0 flex-1 flex-col">
        <span
          className="truncate text-[13px] font-semibold"
          style={{ color: senderColor(image.sender) }}
        >
          {session.nameOf(image.sender)}
        </span>
        <span className="truncate text-[11.5px] text-ink-45 tabular-nums">
          {fullTime(image.ts, i18n.language)}
        </span>
      </div>
      {image.count > 1 && (
        <span
          aria-live="polite"
          className="shrink-0 rounded-full bg-ink/[0.08] px-3 py-1 text-[12px] font-semibold text-ink-80 tabular-nums"
        >
          {t('chat.gallery.viewer.counter', { n: image.position + 1, total: image.count })}
        </span>
      )}
      <div className="flex flex-1 items-center justify-end gap-0.5">
        <BarButton
          label={t('chat.gallery.viewer.zoomOut')}
          onClick={() => zoom?.zoomOut()}
          disabled={scale <= 1}
        >
          <ZoomOut size={17} />
        </BarButton>
        <button
          type="button"
          title={t('chat.gallery.viewer.zoomReset')}
          aria-label={t('chat.gallery.viewer.zoomReset')}
          onClick={() => zoom?.reset()}
          disabled={scale <= 1}
          className="h-7 min-w-12 cursor-pointer rounded-full px-1.5 text-[11.5px] font-semibold text-ink-60 tabular-nums transition-colors duration-150 enabled:hover:bg-ink/[0.1] enabled:hover:text-ink-90 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-default"
        >
          {Math.round(scale * 100)}%
        </button>
        <BarButton
          label={t('chat.gallery.viewer.zoomIn')}
          onClick={() => zoom?.zoomIn()}
          disabled={scale >= ZOOM_MAX}
        >
          <ZoomIn size={17} />
        </BarButton>
        <span aria-hidden className="mx-1.5 h-5 w-px bg-ink/[0.12]" />
        {canJump && (
          <BarButton label={t('chat.gallery.viewer.jump')} onClick={onJump}>
            <MessageSquareShare size={17} />
          </BarButton>
        )}
        <BarButton label={t('chat.gallery.viewer.close')} onClick={onClose}>
          <X size={19} />
        </BarButton>
        <span aria-hidden className="mx-1.5 h-5 w-px bg-ink/[0.12]" />
        <WindowControls />
      </div>
    </header>
  );
});
