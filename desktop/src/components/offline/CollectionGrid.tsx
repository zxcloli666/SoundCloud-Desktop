import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../lib/formatters';
import { CollectionCover } from './CollectionCover';
import type { CollectionView } from './types';

const CollectionCard = React.memo(function CollectionCard({
  view,
  onOpen,
}: {
  view: CollectionView;
  onOpen: (scope: string) => void;
}) {
  const { t } = useTranslation();
  const pct = view.total > 0 ? view.savedCount / view.total : 0;
  const complete = view.total > 0 && view.savedCount >= view.total;

  return (
    <button
      type="button"
      onClick={() => onOpen(view.scope)}
      className="group flex cursor-pointer flex-col gap-3 rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-3 text-left transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:border-white/[0.13] hover:bg-white/[0.04] hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]"
    >
      <div className="relative">
        <CollectionCover view={view} className="aspect-square w-full rounded-[13px]" />
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/80 backdrop-blur-md">
          {t(`offline.kind_${view.kind}`)}
        </span>
        <div className="absolute inset-x-2 bottom-2 h-[3px] overflow-hidden rounded-full bg-black/45">
          <span
            className="block h-full origin-left"
            style={{
              transform: `scaleX(${pct})`,
              background: complete
                ? 'var(--color-accent)'
                : 'linear-gradient(90deg, var(--color-accent-glow), var(--color-accent))',
              transition: 'transform 400ms var(--ease-apple)',
            }}
          />
        </div>
      </div>
      <div className="min-w-0 px-0.5">
        <div className="truncate text-[13.5px] font-semibold text-white/90 group-hover:text-white">
          {view.title}
        </div>
        {view.author && <div className="truncate text-[12px] text-white/45">{view.author}</div>}
        <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] tabular-nums text-white/35">
          <span className={complete ? 'text-emerald-200/70' : undefined}>
            {view.savedCount} / {view.total}
          </span>
          <span>{formatBytes(view.bytes)}</span>
        </div>
      </div>
    </button>
  );
});

export const CollectionGrid = React.memo(function CollectionGrid({
  views,
  emptyText,
  onOpen,
}: {
  views: CollectionView[];
  emptyText: string;
  onOpen: (scope: string) => void;
}) {
  if (views.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-white/[0.08] bg-white/[0.015] px-5 py-12 text-center text-[13px] text-white/30">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {views.map((view) => (
        <CollectionCard key={view.scope} view={view} onOpen={onOpen} />
      ))}
    </div>
  );
});
