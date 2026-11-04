import { memo, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageIcon, RefreshCw } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';
import { CoverGrid } from './CoverGrid';
import { accentColor, accentInk } from './perks';
import type { ArtworkChoices } from './useArtworkChoices';

const SKELETON = Array.from({ length: 8 }, (_, index) => `tile-${index}`);

function RetryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 cursor-pointer items-center gap-1.5 self-center rounded-full bg-ink/[0.08] px-3 text-[11.5px] font-semibold text-ink-80 transition-colors hover:bg-ink/[0.14]"
    >
      <RefreshCw size={11} />
      {label}
    </button>
  );
}

export const CoverChoices = memo(function CoverChoices({
  artwork,
  selected,
  accent,
  onSelect,
  gridRef,
}: {
  artwork: ArtworkChoices;
  selected: string | null;
  accent: number;
  onSelect: (url: string) => void;
  gridRef: Ref<HTMLDivElement>;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();

  if (artwork.loading) {
    return (
      <div aria-busy className="grid grid-cols-4 gap-2 p-1.5">
        {SKELETON.map((id) => (
          <span
            key={id}
            className={`perk-motion aspect-square rounded-[10px] bg-ink/[0.06] ${
              perf.idleAnim ? 'animate-pulse' : ''
            }`}
          />
        ))}
      </div>
    );
  }
  if (artwork.failed) {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
        <p className="text-[12px] font-semibold text-ink-70">
          {t('chat.room.perks.cover.loadFailed')}
        </p>
        <RetryButton label={t('chat.room.perks.cover.retry')} onClick={artwork.retry} />
      </div>
    );
  }
  if (artwork.choices.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
        <span className="flex size-10 items-center justify-center rounded-[10px] border border-dashed border-ink/20 text-ink-35">
          <ImageIcon size={16} />
        </span>
        <p className="text-[12px] font-semibold text-ink-70">{t('chat.room.perks.cover.empty')}</p>
      </div>
    );
  }
  return (
    <>
      <CoverGrid
        gridRef={gridRef}
        choices={artwork.choices}
        selected={selected}
        accent={accentColor(accent)}
        ink={accentInk(accent)}
        onSelect={onSelect}
      />
      {artwork.partial && (
        <RetryButton label={t('chat.room.perks.cover.loadMore')} onClick={artwork.retry} />
      )}
    </>
  );
});
