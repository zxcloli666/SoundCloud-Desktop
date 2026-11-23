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
  const open = useCallback(
    (path: string) => {
      remember();
      navigate(path);
    },
    [remember, navigate],
  );

  const userChips = useMemo(
    () => (users.data ?? []).map((u) => userChip(u, open)),
    [users.data, open],
  );
  const playlistChips = useMemo(
    () => (playlists.data ?? []).map((p) => playlistChip(p, open)),
    [playlists.data, open],
  );
  const chips = [...userChips, ...playlistChips];
  const stripsLoading = strips.some((s) => s.isLoading);
  const failedStrips = strips.filter((s) => s.isError);
  const retryStrips = () => {
    for (const strip of failedStrips) void strip.refetch();
  };

  const empty =
    !tracks.isLoading &&
    !tracks.isError &&
    !stripsLoading &&
    failedStrips.length === 0 &&
    tracks.items.length === 0 &&
    chips.length === 0;

  return (
    <>
      <div className="mb-2 max-w-[1100px] mx-auto w-full">
        {chips.length > 0 ? (
          <>
            <EntityStrip items={userChips} label={t('search.artistsUsers')} />
            <EntityStrip items={playlistChips} label={t('search.playlists')} />
          </>
        ) : (
          stripsLoading && <StripSkeleton />
        )}
        {failedStrips.length > 0 && !tracks.isError && <SectionError onRetry={retryStrips} />}
      </div>
      {empty ? (
        <SearchState
          icon={<Cloud size={26} />}
          title={t('search.soundcloud.emptyTitle', { query: q })}
          body={t('search.soundcloud.emptyBody')}
        />
      ) : tracks.isError && tracks.items.length === 0 ? (
        <SearchError
          error={tracks.error}
          onRetry={() => {
            void tracks.refetch();
            retryStrips();
          }}
        />
      ) : (
        <TrackWall results={tracks} kind="lexical" onOpen={remember} wave />
      )}
      {tracks.isFetchNextPageError && <SectionError onRetry={tracks.loadMore} />}
    </>
  );
});
