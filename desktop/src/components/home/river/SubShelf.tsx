import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import type { Track } from '../../../stores/player';
import { TrackCard } from '../../music/TrackCard';
import { HorizontalScroll } from '../../ui/HorizontalScroll';
import { Skeleton } from '../../ui/Skeleton';
import { SyncNotice } from '../../ui/SyncNotice';

const SHELF_CAP = 24;

function ShelfSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[176px] shrink-0">
          <Skeleton className="aspect-square w-full" rounded="lg" />
          <Skeleton className="mt-2.5 h-4 w-3/4" rounded="sm" />
          <Skeleton className="mt-1.5 h-3 w-1/2" rounded="sm" />
        </div>
      ))}
    </>
  );
}

export function SubShelf({
  index,
  label,
  isLoading,
  isError,
  onRetry,
  tracks,
  onPlay,
  to,
}: {
  index: string;
  label: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  tracks: Track[];
  onPlay?: () => void;
  to?: string;
}) {
  const { t } = useTranslation();
  const cap = usePerfMode().mode === 'beauty' ? Number.POSITIVE_INFINITY : SHELF_CAP;
  if (!isLoading && !isError && tracks.length === 0) return null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5 pl-1">
        <span className="font-mono text-[10.5px] text-ink-25 tabular-nums">{index}</span>
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-55">
          {label}
        </span>
        <span className="h-px flex-1 bg-ink/[0.05]" />
        {to && (
          <Link
            to={to}
            className="flex items-center gap-0.5 text-[12px] font-semibold text-ink-45 transition-colors hover:text-ink-90"
          >
            {t('library.seeAll')}
            <ChevronRight size={14} />
          </Link>
        )}
      </div>
      {isError ? (
        <div className="py-6">
          <SyncNotice kind="failed" onRetry={onRetry} />
        </div>
      ) : (
        <HorizontalScroll>
          {isLoading ? (
            <ShelfSkeleton />
          ) : (
            tracks.slice(0, cap).map((track) => (
              <div key={track.urn} className="w-[176px] shrink-0">
                <TrackCard track={track} queue={tracks} onPlay={onPlay} />
              </div>
            ))
          )}
        </HorizontalScroll>
      )}
    </div>
  );
}
