import { Cloud, Database } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useCatalogStrip,
  useCatalogTracks,
  useLyricsHits,
  useRememberQuery,
} from '../../lib/search';
import { useSearchPrefsStore } from '../../stores/searchPrefs';
import { EntityStrip } from './EntityStrip';
import { albumChip, artistChip, playlistChip, userChip } from './entityChips';
import { LyricsRow } from './LyricsRow';
import { SearchError, SearchState, SectionError, StripSkeleton } from './SearchState';
import { TrackWall } from './TrackWall';

const CHIPS_PER_KIND = 6;

export const CatalogResults = memo(function CatalogResults({ q }: { q: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setMode = useSearchPrefsStore((s) => s.setMode);
  const remember = useRememberQuery(q);
  const tracks = useCatalogTracks(q);
  const lyrics = useLyricsHits(q);
  const artists = useCatalogStrip('artists', q);
  const users = useCatalogStrip('users', q);
  const playlists = useCatalogStrip('playlists', q);
  const albums = useCatalogStrip('albums', q);
  const strips = [artists, users, playlists, albums];

  const chips = useMemo(
    () => [
      ...(artists.data ?? []).slice(0, CHIPS_PER_KIND).map((a) => artistChip(a, navigate)),
      ...(users.data ?? []).slice(0, CHIPS_PER_KIND).map((u) => userChip(u, navigate)),
      ...(playlists.data ?? []).slice(0, CHIPS_PER_KIND).map((p) => playlistChip(p, navigate)),
      ...(albums.data ?? []).slice(0, CHIPS_PER_KIND).map((a) => albumChip(a, navigate)),
    ],
    [artists.data, users.data, playlists.data, albums.data, navigate],
  );
  const stripsLoading = strips.some((s) => s.isLoading);
  const failedStrips = strips.filter((s) => s.isError);
  const retryStrips = () => {
    for (const strip of failedStrips) void strip.refetch();
  };
  const loadMore = useCallback(() => void tracks.fetchNextPage(), [tracks.fetchNextPage]);
  const moreLyrics = useCallback(() => void lyrics.fetchNextPage(), [lyrics.fetchNextPage]);

  const settled = !tracks.isLoading && !lyrics.isLoading && !stripsLoading;
  const nothing =
    settled &&
    !tracks.isError &&
    !lyrics.isError &&
    failedStrips.length === 0 &&
    tracks.items.length === 0 &&
    lyrics.items.length === 0 &&
    chips.length === 0;

  if (nothing) {
    return (
      <SearchState
        icon={<Database size={26} />}
        title={t('search.catalog.emptyTitle', { query: q })}
        body={t('search.catalog.emptyBody')}
        cta={t('search.catalog.emptyCta')}
        ctaIcon={<Cloud size={15} />}
        onAction={() => setMode('soundcloud')}
      />
    );
  }

  return (
    <>
      <div className="mb-2 max-w-[1100px] mx-auto w-full">
        <div onClickCapture={remember}>
          {chips.length > 0 ? <EntityStrip items={chips} /> : stripsLoading && <StripSkeleton />}
        </div>
        {failedStrips.length > 0 && <SectionError onRetry={retryStrips} />}
      </div>
      {lyrics.isError && lyrics.items.length === 0 ? (
        <SectionError onRetry={() => void lyrics.refetch()} />
      ) : (
        <div onClickCapture={remember}>
          <LyricsRow
            hits={lyrics.items}
            hasMore={!!lyrics.hasNextPage && !lyrics.isFetchNextPageError}
            isFetchingMore={lyrics.isFetchingNextPage}
            onMore={moreLyrics}
          />
        </div>
      )}
      {lyrics.isFetchNextPageError && <SectionError onRetry={moreLyrics} />}
      {tracks.isError && tracks.items.length === 0 ? (
        <SearchError error={tracks.error} onRetry={() => void tracks.refetch()} />
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
