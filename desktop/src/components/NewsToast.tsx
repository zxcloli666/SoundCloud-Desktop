import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {proxiedAssetUrl} from '../lib/asset-url';
import {NEWS, type NewsItem, SHOW_NEWS} from '../lib/constants';
import {X} from '../lib/icons';
import {useNewsStore} from '../stores/news';
import {Modal, ModalClose, ModalContent, ModalTitle, ModalTrigger} from './ui/Modal';

// ─── Toast Card (bottom-left) ──────────────────────────────

const accentBorder: Record<string, string> = {
  violet: 'border-violet-400/20 hover:border-violet-400/30',
  amber: 'border-amber-400/20 hover:border-amber-400/30',
  sky: 'border-sky-400/20 hover:border-sky-400/30',
  emerald: 'border-emerald-400/20 hover:border-emerald-400/30',
};

const accentGlow: Record<string, string> = {
  violet: 'shadow-[0_0_30px_rgba(139,92,246,0.08)]',
  amber: 'shadow-[0_0_30px_rgba(251,191,36,0.08)]',
  sky: 'shadow-[0_0_30px_rgba(56,189,248,0.08)]',
  emerald: 'shadow-[0_0_30px_rgba(52,211,153,0.08)]',
};

const accentDot: Record<string, string> = {
  violet: 'bg-violet-400',
  amber: 'bg-amber-400',
  sky: 'bg-sky-400',
  emerald: 'bg-emerald-400',
};

const SingleNewsToast = React.memo(function SingleNewsToast({
  item,
  index,
}: {
  item: NewsItem;
  index: number;
}) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const dismiss = useNewsStore((s) => s.dismiss);

  const accent = item.accent ?? 'violet';
  const border = accentBorder[accent] ?? accentBorder.violet;
  const glow = accentGlow[accent] ?? accentGlow.violet;
  const dot = accentDot[accent] ?? accentDot.violet;

  // Dismiss from the toast cross — never opens the modal.
  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dismiss(item.id);
    },
    [dismiss, item.id],
  );

  // Any modal close (button, header cross, escape, click-outside) dismisses for good.
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setModalOpen(open);
      if (!open) dismiss(item.id);
    },
    [dismiss, item.id],
  );

  return (
    <Modal open={modalOpen} onOpenChange={handleOpenChange}>
      {/* Toast */}
      <div
        data-ui="toast"
        className={`group relative animate-in slide-in-from-left-4 fade-in duration-500 fill-mode-both`}
        style={{ animationDelay: `${index * 120}ms` }}
      >
        <ModalTrigger asChild>
          <button
            type="button"
            className={`relative flex w-[340px] cursor-pointer items-start gap-3.5 rounded-2xl border bg-surface-hi/90 px-4 py-3.5 text-left backdrop-blur-xl transition-all duration-300 ease-[var(--ease-apple)] ${border} ${glow} hover:bg-surface-hi/95 hover:scale-[1.01]`}
          >
            {/* Accent dot */}
            <div className={`mt-1.5 size-2 shrink-0 rounded-full ${dot} animate-pulse`} />

            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-ink-90 leading-tight">
                {t(item.titleKey)}
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-ink-45 line-clamp-2">
                {t(item.descriptionKey)}
              </div>
            </div>

            {item.image && (
              <img
                src={proxiedAssetUrl(item.image) ?? item.image}
                alt=""
                className="size-11 shrink-0 rounded-xl object-cover ring-1 ring-ink/[0.06]"
                decoding="async"
              />
            )}
          </button>
        </ModalTrigger>

        {/* Close — вне триггера, чтобы избежать <button> в <button> */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-lg bg-ink/0 text-ink-0 transition-all group-hover:bg-ink/[0.06] group-hover:text-ink-40 hover:!bg-ink/[0.1] hover:!text-ink-60"
        >
          <X size={12} />
        </button>
      </div>

      {/* Modal */}
      <ModalContent size="md" showClose={false} zClass="z-[100]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`size-2.5 rounded-full ${dot}`} />
            <ModalTitle className="text-[15px] font-semibold text-ink-92">
              {t(item.titleKey)}
            </ModalTitle>
          </div>
          <ModalClose className="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-ink/[0.05] text-ink-40 transition-colors hover:bg-ink/[0.1] hover:text-ink-60">
            <X size={14} />
          </ModalClose>
        </div>

        {/* Image */}
        {item.image && (
          <div className="px-5 pb-3">
            <img
              src={proxiedAssetUrl(item.image) ?? item.image}
              alt=""
              className="w-full rounded-xl object-cover ring-1 ring-ink/[0.06]"
              decoding="async"
            />
          </div>
        )}

        {/* Body */}
        <div className="px-5 pb-4">
          <p className="selectable text-[13px] leading-relaxed text-ink-60 whitespace-pre-line">
            {t(item.bodyKey)}
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5">
          <ModalClose className="w-full cursor-pointer rounded-xl bg-ink/[0.08] py-2.5 text-[13px] font-medium text-ink-70 transition-colors hover:bg-ink/[0.12]">
            {t('news.close')}
          </ModalClose>
        </div>
      </ModalContent>
    </Modal>
  );
});

// ─── Container ──────────────────────────────────────────────

export const NewsToast = React.memo(function NewsToast() {
  const dismissed = useNewsStore((s) => s.dismissed);

  const visible = useMemo(
    () => (SHOW_NEWS ? NEWS.filter((item) => !dismissed.includes(item.id)) : []),
    [dismissed],
  );

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 z-[999] flex flex-col gap-2.5">
      {visible.map((item, i) => (
        <SingleNewsToast key={item.id} item={item} index={i} />
      ))}
    </div>
  );
});
