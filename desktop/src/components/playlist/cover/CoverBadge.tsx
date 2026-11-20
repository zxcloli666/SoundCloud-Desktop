import React from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, ImagePlus, Loader2, RotateCcw, TriangleAlert, X } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import type { CoverChange } from '../../../stores/playlist-cover';

const IMAGE_ERRORS = new Set([
  'playlist.cover.tooSmall',
  'playlist.cover.tooLarge',
  'playlist.cover.unsupported',
  'playlist.cover.unreadable',
]);

const CHIP =
  'inline-flex h-7 items-center gap-1.5 rounded-full pl-2.5 pr-1 text-[10.5px] font-bold text-ink-85 animate-fade-in-up motion-reduce:animate-none';
const CHIP_STYLE = {
  background: 'rgb(var(--paper) / 0.82)',
  border: '0.5px solid rgb(var(--ink) / 0.14)',
  boxShadow: '0 8px 20px rgb(var(--shade) / calc(0.4 * var(--shade-alpha)))',
};
const ICON_BUTTON =
  'inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-60 transition-colors hover:bg-ink/[0.12] hover:text-ink-95 cursor-pointer';

export const CoverBadge = React.memo(function CoverBadge({
  change,
  onRetry,
  onPick,
  onDrop,
}: {
  change: CoverChange;
  onRetry: () => void;
  onPick: () => void;
  onDrop: () => void;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();

  if (change.phase === 'failed') {
    const error = change.error ?? 'playlist.cover.notSaved';
    const imageError = IMAGE_ERRORS.has(error);
    return (
      <span
        data-ui="playlist-cover-state"
        data-state="failed"
        role="alert"
        className={CHIP}
        style={CHIP_STYLE}
      >
        <TriangleAlert size={12} className="text-bad" />
        <span className="max-w-[96px] truncate">{t(error)}</span>
        <button
          type="button"
          onClick={imageError ? onPick : onRetry}
          title={imageError ? t('playlist.cover.pickAnother') : t('common.retry')}
          aria-label={imageError ? t('playlist.cover.pickAnother') : t('common.retry')}
          className={ICON_BUTTON}
        >
          {imageError ? <ImagePlus size={12} /> : <RotateCcw size={12} />}
        </button>
        <button
          type="button"
          onClick={onDrop}
          title={t('common.close')}
          aria-label={t('common.close')}
          className={ICON_BUTTON}
        >
          <X size={12} />
        </button>
      </span>
    );
  }

  const sending = change.phase === 'sending';
  const label = sending ? t('playlist.cover.sending') : t('playlist.cover.syncing');
  return (
    <span
      data-ui="playlist-cover-state"
      data-state={change.phase}
      role="status"
      title={label}
      className={`${CHIP} pr-2.5`}
      style={CHIP_STYLE}
    >
      {sending ? (
        <Loader2 size={12} className="animate-spin text-accent motion-reduce:animate-none" />
      ) : (
        <CloudUpload
          size={12}
          className={`text-accent ${perf.idleAnim ? 'animate-pulse motion-reduce:animate-none' : ''}`}
        />
      )}
      {label}
    </span>
  );
});
