import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, History, Images, LoaderCircle, RotateCcw } from './icons';
import { Shimmer } from './MediaFace';
import { useCalmMotion } from './motion';

const SKELETON = Array.from({ length: 9 }, (_, index) => index);

function RetryButton({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onRetry}
      className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-ink/[0.06] px-3.5 text-[12px] font-semibold text-ink-75 transition-colors duration-150 hover:bg-ink/[0.1] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
    >
      <RotateCcw size={13} />
      {t('chat.gallery.grid.retry')}
    </button>
  );
}

export const GallerySkeleton = memo(function GallerySkeleton() {
  const { t } = useTranslation();
  const calm = useCalmMotion();
  return (
    <div
      role="status"
      aria-label={t('chat.gallery.grid.loading')}
      className="grid grid-cols-3 gap-[3px] overflow-hidden rounded-[14px]"
    >
      {SKELETON.map((index) => (
        <span key={index} className="relative aspect-square overflow-hidden bg-ink/[0.05]">
          {!calm && <Shimmer />}
        </span>
      ))}
    </div>
  );
});

export const GalleryEmpty = memo(function GalleryEmpty({ onOlder }: { onOlder?: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      data-ui="chat-gallery-empty"
      className="flex flex-col items-center gap-3 py-10 text-center"
    >
      <span aria-hidden className="relative h-16 w-24">
        <span className="absolute top-2 left-1 size-12 -rotate-12 rounded-[14px] bg-ink/[0.04] ring-1 ring-ink/[0.06]" />
        <span className="absolute top-2 right-1 size-12 rotate-12 rounded-[14px] bg-ink/[0.04] ring-1 ring-ink/[0.06]" />
        <span className="absolute top-0 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-[16px] bg-ink/[0.07] text-ink-40 ring-1 ring-ink/[0.08]">
          <Images size={22} strokeWidth={1.7} />
        </span>
      </span>
      <span className="text-[13.5px] font-semibold text-ink-80">
        {t('chat.gallery.grid.empty')}
      </span>
      <span className="max-w-[240px] text-[12px] leading-snug text-ink-40">
        {t('chat.gallery.grid.emptyHint')}
      </span>
      {onOlder && (
        <button
          type="button"
          onClick={onOlder}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-ink/[0.06] px-3.5 text-[12px] font-semibold text-ink-75 transition-colors duration-150 hover:bg-ink/[0.1] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          <History size={13} />
          {t('chat.gallery.grid.older')}
        </button>
      )}
    </div>
  );
});

export const GalleryFailed = memo(function GalleryFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-ink/[0.05] text-ink-40">
        <CircleAlert size={20} />
      </span>
      <span className="text-[12.5px] text-ink-55">{t('chat.gallery.grid.failed')}</span>
      <RetryButton onRetry={onRetry} />
    </div>
  );
});

export const GalleryTail = memo(function GalleryTail({
  state,
  onRetry,
}: {
  state: 'idle' | 'loading' | 'failed';
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const calm = useCalmMotion();
  if (state === 'idle') return null;
  if (state === 'failed') {
    return (
      <div className="flex items-center justify-center gap-3 py-4 text-[12px] text-ink-45">
        {t('chat.gallery.grid.moreFailed')}
        <RetryButton onRetry={onRetry} />
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-label={t('chat.gallery.grid.loading')}
      className="flex justify-center py-4 text-ink-40"
    >
      <LoaderCircle
        size={16}
        className="chat-media-motion"
        style={{ animation: calm ? undefined : 'chat-media-spin 0.9s linear infinite' }}
      />
    </div>
  );
});
