import { Cloud } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useRememberQuery, useScStrip, useScTracks } from '../../lib/search';
import { EntityStrip } from './EntityStrip';
import { playlistChip, userChip } from './entityChips';
import { SearchError, SearchState, SectionError, StripSkeleton } from './SearchState';
import { TrackWall } from './TrackWall';

export const SoundCloudResults = memo(function SoundCloudResults({ q }: { q: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const remember = useRememberQuery(q);
  const tracks = useScTracks(q);
  const playlists = useScStrip('playlists', q);
  const users = useScStrip('users', q);
  const strips = [playlists, users];

  const chips = useMemo(
    () => [
      ...(playlists.data ?? []).filter((p) => p?.urn).map((p) => playlistChip(p, navigate)),
      ...(users.data ?? []).filter((u) => u?.urn).map((u) => userChip(u, navigate)),
    ],
    [playlists.data, users.data, navigate],
  );
  const stripsLoading = strips.some((s) => s.isLoading);
  const failedStrips = strips.filter((s) => s.isError);
  const retryStrips = () => {
    for (const strip of failedStrips) void strip.refetch();
  };
  const loadMore = useCallback(() => void tracks.fetchNextPage(), [tracks.fetchNextPage]);

  const nothing =
    !tracks.isLoading &&
    !stripsLoading &&
    !tracks.isError &&
    failedStrips.length === 0 &&
    tracks.items.length === 0 &&
    chips.length === 0;

  if (nothing) {
    return (
      <SearchState
        icon={<Cloud size={26} />}
        title={t('search.soundcloud.emptyTitle', { query: q })}
        body={t('search.soundcloud.emptyBody')}
      />
    );
  }

  return (
    <>
      <div className="mb-2 max-w-[1100px] mx-auto w-full">
        <div onClickCapture={remember}>
          {chips.length > 0 ? <EntityStrip items={chips} /> : stripsLoading && <StripSkeleton />}
        </div>
        {failedStrips.length > 0 && !tracks.isError && <SectionError onRetry={retryStrips} />}
      </div>
      {tracks.isError && tracks.items.length === 0 ? (
        <SearchError
          error={tracks.error}
          onRetry={() => {
            void tracks.refetch();
            retryStrips();
          }}
        />
      ) : (
        <div onClickCapture={remember}>
          <TrackWall
            tracks={tracks.items}
            kind="lexical"
            isLoading={tracks.isLoading}
            hasMore={!!tracks.hasNextPage && !tracks.isFetchNextPageError}
            isFetchingMore={tracks.isFetchingNextPage}
            onLoadMore={loadMore}
          />
        </div>
      )}
      {tracks.isFetchNextPageError && <SectionError onRetry={loadMore} />}
    </>
  );
});
