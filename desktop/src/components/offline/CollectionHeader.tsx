import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../lib/formatters';
import { ChevronLeft, Trash2 } from '../../lib/icons';
import { CollectionCover } from './CollectionCover';
import type { CollectionView } from './types';

const CONFIRM_RESET_MS = 4000;

export const CollectionHeader = React.memo(function CollectionHeader({
  view,
  onBack,
  onRemove,
}: {
  view: CollectionView;
  onBack: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), CONFIRM_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-3 pr-4">
      <button
        type="button"
        onClick={onBack}
        aria-label={t('search.back')}
        className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white"
      >
        <ChevronLeft size={18} />
      </button>
      <CollectionCover view={view} className="size-16 flex-none rounded-[12px]" />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/35">
          {t(`offline.kind_${view.kind}`)}
        </div>
        <div className="truncate text-[18px] font-semibold tracking-[-0.02em] text-white/92">
          {view.title}
        </div>
        <div className="truncate text-[12px] text-white/45">
          {[
            view.author,
            t('offline.collectionSaved', { saved: view.savedCount, total: view.total }),
            formatBytes(view.bytes),
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <button
        type="button"
        onClick={() => (confirming ? onRemove() : setConfirming(true))}
        className={`flex h-9 cursor-pointer items-center gap-2 rounded-[11px] border px-3.5 text-[12.5px] font-semibold transition-colors ${
          confirming
            ? 'border-red-500/30 bg-red-500/15 text-red-300'
            : 'border-white/[0.08] bg-white/[0.03] text-white/55 hover:border-red-500/25 hover:text-red-300'
        }`}
      >
        <Trash2 size={13} />
        {confirming ? t('offline.collectionRemoveConfirm') : t('offline.collectionRemove')}
      </button>
    </div>
  );
});
