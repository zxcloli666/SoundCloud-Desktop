import React from 'react';
import {useTranslation} from 'react-i18next';
import {useDiscoverFeed} from '../../../lib/hooks';
import {armLikesContinuation, armSuperlikesContinuation} from '../../../lib/queue-continuation';
import {useSuperlikeCount, useWarmSuperlikedTracks} from '../../../lib/superlikes';
import type {Track} from '../../../stores/player';
import {SubShelf} from './SubShelf';

export type ArchiveShelf = 'superlikes' | 'likes' | 'recommended';

interface ArchiveProps {
  shelves: ArchiveShelf[];
  titled: boolean;
  likedTracks: Track[];
  likedLoading: boolean;
  likedFailed: boolean;
  onRetryLiked: () => void;
}

interface ShelfTracks {
  tracks: Track[];
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

const NO_TRACKS: ShelfTracks = { tracks: [], isLoading: false, isError: false, retry: () => {} };

const SHELVES: Record<ArchiveShelf, { label: string; onPlay?: () => void; to?: string }> = {
  superlikes: {
    label: 'superlikes.title',
    onPlay: armSuperlikesContinuation,
    to: '/library/superlikes',
  },
  likes: { label: 'library.likedTracks', onPlay: armLikesContinuation },
  recommended: { label: 'home.recommended' },
};

function useSuperlikesShelf(shelves: ArchiveShelf[]): ShelfTracks {
  const count = useSuperlikeCount();
  const shown = shelves.includes('superlikes') && count > 0;
  const { tracks, isLoading, isError, refetch } = useWarmSuperlikedTracks(shown);
  if (!shown) return NO_TRACKS;
  return {
    tracks,
    isLoading,
    isError: isError && tracks.length === 0,
    retry: () => void refetch(),
  };
}

function ArchiveView({
  shelves,
  titled,
  likedTracks,
  likedLoading,
  likedFailed,
  onRetryLiked,
  superliked,
  recommended,
}: ArchiveProps & { superliked: ShelfTracks; recommended: ShelfTracks }) {
  const { t } = useTranslation();
  const lists: Record<ArchiveShelf, ShelfTracks> = {
    superlikes: superliked,
    likes: {
      tracks: likedTracks,
      isLoading: likedLoading,
      isError: likedFailed,
      retry: onRetryLiked,
    },
    recommended,
  };
  const filled = shelves.filter(
    (shelf) => lists[shelf].isLoading || lists[shelf].isError || lists[shelf].tracks.length > 0,
  );
  if (filled.length === 0) return null;

  return (
    <section className="pt-14">
      {titled && (
        <div className="mb-5">
          <h2 className="text-[22px] font-bold leading-tight tracking-[-0.015em] text-ink-92">
            {t('soundwave.river.archiveTitle')}
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-ink-50">
            {t('soundwave.river.archiveWhy')}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-8">
        {filled.map((shelf, i) => (
          <SubShelf
            key={shelf}
            index={String(i + 1).padStart(2, '0')}
            label={t(SHELVES[shelf].label)}
            isLoading={lists[shelf].isLoading}
            isError={lists[shelf].isError}
            onRetry={lists[shelf].retry}
            tracks={lists[shelf].tracks}
            onPlay={SHELVES[shelf].onPlay}
            to={SHELVES[shelf].to}
          />
        ))}
      </div>
    </section>
  );
}

function RecommendedArchive(props: ArchiveProps & { superliked: ShelfTracks }) {
  const discover = useDiscoverFeed();
  const likesFailureShown = props.likedFailed && props.shelves.includes('likes');
  return (
    <ArchiveView
      {...props}
      recommended={{
        tracks: discover.recommended,
        isLoading: discover.isLoading,
        isError: discover.isError && !likesFailureShown,
        retry: () => void discover.refetch(),
      }}
    />
  );
}

export const ArchiveStation = React.memo(function ArchiveStation(props: ArchiveProps) {
  const superliked = useSuperlikesShelf(props.shelves);
  return props.shelves.includes('recommended') ? (
    <RecommendedArchive {...props} superliked={superliked} />
  ) : (
    <ArchiveView {...props} superliked={superliked} recommended={NO_TRACKS} />
  );
});
