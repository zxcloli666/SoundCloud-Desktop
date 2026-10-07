import { Loader2, Quote } from 'lucide-react';
import { memo, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { armTrackWaveContinuation } from '../../lib/queue-continuation';
import type { LyricsHit } from '../../lib/search';
import { CoverTile } from './CoverTile';
import type { WallItem } from './utils';

interface LyricsRowProps {
  hits: LyricsHit[];
  hasMore: boolean;
  isFetchingMore: boolean;
  onMore: () => void;
  onOpen: () => void;
  wave?: boolean;
}

const TILE_PX = 184;

export const LyricsRow = memo(function LyricsRow({
  hits,
  hasMore,
  isFetchingMore,
  onMore,
  onOpen,
  wave,
}: LyricsRowProps) {
  const { t } = useTranslation();
  const items = useMemo<WallItem[]>(
    () => hits.map((hit) => ({ track: hit.track, kind: 'lyric', matchedLine: hit.matchedLine })),
    [hits],
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const getQueue = useCallback(
    () => (wave ? [] : itemsRef.current.map((item) => item.track)),
    [wave],
  );

  if (items.length === 0) return null;
  return (
    <section className="mb-4">
      <h3 className="flex items-center gap-1.5 px-4 mb-2 text-[11px] uppercase tracking-wide text-white/35">
        <Quote size={12} />
        {t('search.catalog.inLyrics')}
      </h3>
      <div
        className="tg-wall grid grid-flow-col gap-3 px-4 pb-2 overflow-x-auto"
        style={{
          gridAutoColumns: `${TILE_PX}px`,
          gridTemplateRows: `${TILE_PX}px`,
          scrollbarWidth: 'none',
        }}
      >
        {items.map((item) => (
          <CoverTile
            key={item.track.urn}
            item={item}
            getQueue={getQueue}
            onOpen={onOpen}
            onPlay={wave ? armTrackWaveContinuation : undefined}
          />
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={onMore}
            disabled={isFetchingMore}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl text-[12px] text-white/55 hover:text-white transition-colors cursor-pointer bg-white/[0.03] border border-white/10"
          >
            {isFetchingMore ? <Loader2 size={18} className="animate-spin" /> : null}
            {t('search.catalog.showMore')}
          </button>
        )}
      </div>
    </section>
  );
});
