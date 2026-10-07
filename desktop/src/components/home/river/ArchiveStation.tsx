import React from 'react';
import {useTranslation} from 'react-i18next';
import {useDiscoverFeed} from '../../../lib/hooks';
import {usePerfMode} from '../../../lib/perf';
import {armLikesContinuation} from '../../../lib/queue-continuation';
import type {Track} from '../../../stores/player';
import {TrackCard} from '../../music/TrackCard';
import {HorizontalScroll} from '../../ui/HorizontalScroll';
import {Skeleton} from '../../ui/Skeleton';

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

function SubShelf({
  index,
  label,
  isLoading,
  tracks,
  onPlay,
}: {
  index: string;
  label: string;
  isLoading: boolean;
  tracks: Track[];
  onPlay?: () => void;
}) {
  const cap = usePerfMode().mode === 'beauty' ? Number.POSITIVE_INFINITY : SHELF_CAP;
  if (!isLoading && tracks.length === 0) return null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5 pl-1">
        <span className="font-mono text-[10.5px] text-white/25 tabular-nums">{index}</span>
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/55">
          {label}
        </span>
        <span className="h-px flex-1 bg-white/[0.05]" />
      </div>
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
    </div>
  );
}

/** «Архив эфира» — лайкнутое и рекомендованное вне эфирной сетки, одним блоком. */
export const ArchiveStation = React.memo(function ArchiveStation({
  likedTracks,
  likedLoading,
}: {
  likedTracks: Track[];
  likedLoading: boolean;
}) {
  const { t } = useTranslation();
  const discover = useDiscoverFeed();
  const recommended = discover.recommended;

  if (
    !likedLoading &&
    likedTracks.length === 0 &&
    !discover.isLoading &&
    recommended.length === 0
  ) {
    return null;
  }

  return (
    <section className="pt-14">
      <div className="mb-5">
        <h2 className="text-[22px] font-bold leading-tight tracking-[-0.015em] text-white/92">
          {t('soundwave.river.archiveTitle')}
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-white/50">
          {t('soundwave.river.archiveWhy')}
        </p>
      </div>
      <div className="flex flex-col gap-8">
        <SubShelf
          index="01"
          label={t('library.likedTracks')}
          isLoading={likedLoading}
          tracks={likedTracks}
          onPlay={armLikesContinuation}
        />
        <SubShelf
          index="02"
          label={t('home.recommended')}
          isLoading={discover.isLoading}
          tracks={recommended}
        />
      </div>
    </section>
  );
});
