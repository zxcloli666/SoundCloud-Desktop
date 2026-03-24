import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AddToPlaylistDialog } from '../components/music/AddToPlaylistDialog';
import { LikeButton } from '../components/music/LikeButton';
import { PlaylistCard } from '../components/music/PlaylistCard';
import { VirtualGrid } from '../components/ui/VirtualGrid';
import { VirtualList } from '../components/ui/VirtualList';
import { api } from '../lib/api';
import { preloadTrack } from '../lib/audio';
import { art, dur, fc } from '../lib/formatters';
import {
  fetchAllLikedTracks,
  type HistoryEntry,
  type SCUser,
  useHistory,
  useInfiniteScroll,
  useLikedTracks,
  useMyFollowings,
  useMyLikedPlaylists,
  useMyPlaylists,
} from '../lib/hooks';
import {
  Heart,
  headphones11,
  heart11,
  ListMusic,
  ListPlus,
  Loader2,
  Music,
  pauseWhite14,
  playBlack20ml1,
  playWhite14,
  Search as SearchIcon,
  User,
  Users,
  X,
} from '../lib/icons';
import { useTrackPlay } from '../lib/useTrackPlay';
import { useAuthStore } from '../stores/auth';
import type { Track } from '../stores/player';
import { usePlayerStore } from '../stores/player';

/* ── Components ───────────────────────────────────────────── */

const LibraryTrackRow = React.memo(
  function LibraryTrackRow({
    track,
    index,
    queue,
    onPlay,
  }: {
    track: Track;
    index: number;
    queue: Track[];
    onPlay?: () => void;
  }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isThis, isThisPlaying, togglePlay: baseToggle } = useTrackPlay(track, queue);

    const togglePlay = useCallback(() => {
      baseToggle();
      if (!isThis && onPlay) onPlay();
    }, [baseToggle, isThis, onPlay]);

    const handleAddToQueue = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      usePlayerStore.getState().addToQueueNext([track]);
    }, [track]);

    const cover = art(track.artwork_url, 't200x200');

    return (
      <div
        className={`group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 ease-[var(--ease-apple)] ${
          isThis
            ? 'bg-accent/[0.06] ring-1 ring-accent/20 shadow-[inset_0_0_20px_rgba(255,85,0,0.05)]'
            : 'hover:bg-white/[0.04]'
        }`}
      >
        <div
          className="w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer"
          onClick={togglePlay}
          onMouseEnter={() => preloadTrack(track.urn)}
        >
          {isThisPlaying ? (
            <div className="w-8 h-8 rounded-full bg-accent text-accent-contrast flex items-center justify-center shadow-[0_0_15px_var(--color-accent-glow)] scale-100 animate-fade-in-up">
              {pauseWhite14}
            </div>
          ) : (
            <>
              <span className="text-[13px] text-white/20 tabular-nums font-medium group-hover:hidden">
                {index + 1}
              </span>
              <div className="hidden group-hover:flex w-8 h-8 rounded-full bg-white/10 items-center justify-center hover:bg-white/20 hover:scale-105 transition-all">
                {playWhite14}
              </div>
            </>
          )}
        </div>

        <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.08] shadow-md">
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" decoding="async" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.05] to-transparent">
              <Music size={14} className="text-white/20" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p
            className={`text-[14px] font-medium truncate cursor-pointer transition-colors duration-200 ${
              isThis
                ? 'text-accent drop-shadow-[0_0_8px_rgba(255,85,0,0.4)]'
                : 'text-white/90 hover:text-white'
            }`}
            onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
          >
            {track.title}
          </p>
          <p
            className="text-[12px] text-white/40 truncate mt-0.5 cursor-pointer hover:text-white/70 transition-colors"
            onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
          >
            {track.user.username}
          </p>
        </div>

        <LikeButton track={track} />

        <AddToPlaylistDialog trackUrns={[track.urn]}>
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/80 hover:bg-white/[0.08] transition-all duration-200 shrink-0"
            title={t('playlist.addToPlaylist')}
          >
            <ListMusic size={16} />
          </button>
        </AddToPlaylistDialog>

        <button
          type="button"
          onClick={handleAddToQueue}
          className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/80 hover:bg-white/[0.08] transition-all duration-200 shrink-0"
          title={t('player.addToQueue')}
        >
          <ListPlus size={16} />
        </button>

        <div className="hidden sm:flex items-center gap-4 shrink-0 pr-4">
          {track.playback_count != null && (
            <span className="text-[11px] text-white/30 tabular-nums flex items-center gap-1.5 w-16">
              {headphones11}
              {fc(track.playback_count)}
            </span>
          )}
          <span className="text-[11px] text-white/30 tabular-nums flex items-center gap-1.5 w-14">
            {heart11}
            {fc(track.favoritings_count ?? track.likes_count)}
          </span>
        </div>

        <span className="text-[12px] text-white/30 tabular-nums font-medium shrink-0 w-12 text-right">
          {dur(track.duration)}
        </span>
      </div>
    );
  },
  (prev, next) => prev.track.urn === next.track.urn && prev.index === next.index,
);

const UserCard = React.memo(({ user }: { user: SCUser }) => {
  const navigate = useNavigate();
  const avatar = art(user.avatar_url, 't300x300');

  return (
    <div
      className="group flex flex-col items-center gap-4 p-5 rounded-3xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.08] transition-all duration-300 cursor-pointer"
      onClick={() => navigate(`/user/${encodeURIComponent(user.urn)}`)}
    >
      <div className="relative w-24 h-24 rounded-full shadow-xl overflow-hidden ring-2 ring-white/[0.05] group-hover:ring-white/[0.15] group-hover:scale-105 transition-all duration-500">
        {avatar ? (
          <img
            src={avatar}
            alt={user.username}
            className="w-full h-full object-cover"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <User size={32} className="text-white/20" />
          </div>
        )}
      </div>

      <div className="text-center w-full">
        <p className="text-[15px] font-bold text-white/90 truncate group-hover:text-white transition-colors">
          {user.username}
        </p>
        <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-white/30 font-medium">
          <span className="uppercase tracking-wider flex items-center gap-1">
            <Users size={10} />
            {fc(user.followers_count)}
          </span>
        </div>
      </div>
    </div>
  );
});

/* ── Isolated Hero ────────────────────────────────────────── */

const LibraryHero = React.memo(function LibraryHero({
  onTabLikes,
  onTabFollowing,
}: {
  onTabLikes: () => void;
  onTabFollowing: () => void;
}) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { tracks: likedTracks } = useLikedTracks();
  const { users: followings } = useMyFollowings();
  const [shuffleLoading, setShuffleLoading] = useState(false);

  const handleShuffleLikes = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (shuffleLoading) return;

    setShuffleLoading(true);
    try {
      const all = await fetchAllLikedTracks();
      if (all.length === 0) return;

      if (!usePlayerStore.getState().shuffle) {
        usePlayerStore.setState({ shuffle: true });
      }
      const random = all[Math.floor(Math.random() * all.length)];
      usePlayerStore.getState().play(random, all);
    } finally {
      setShuffleLoading(false);
    }
  };

  if (!user) return null;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Liked Tracks Card */}
      <div
        className="relative h-[240px] rounded-[32px] overflow-hidden p-8 flex flex-col justify-between group cursor-pointer shadow-2xl transition-transform active:scale-[0.99]"
        onClick={onTabLikes}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-orange-500/20" />
        <div className="absolute inset-0 backdrop-blur-[40px] bg-white/[0.03] border border-white/[0.08] rounded-[32px]" />

        <div className="relative z-10">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md mb-4 shadow-inner ring-1 ring-white/10">
            <Heart size={24} className="text-white fill-white/20" />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">
            {t('library.likedTracks')}
          </h2>
          <p className="text-white/50 font-medium mt-1">
            {fc(user.public_favorites_count)} {t('search.tracks').toLowerCase()}
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between mt-auto">
          <div className="flex -space-x-3">
            {likedTracks.slice(0, 4).map((track) => (
              <div
                key={track.id}
                className="w-10 h-10 rounded-full ring-2 ring-[#121214] bg-neutral-800 overflow-hidden relative z-[1]"
              >
                <img
                  src={art(track.artwork_url, 'small') || ''}
                  className="w-full h-full object-cover"
                  alt=""
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleShuffleLikes}
            disabled={shuffleLoading}
            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)] disabled:opacity-60"
          >
            {shuffleLoading ? (
              <Loader2 size={20} className="animate-spin text-black" />
            ) : (
              playBlack20ml1
            )}
          </button>
        </div>
      </div>

      {/* Following Card */}
      <div
        className="relative h-[240px] rounded-[32px] overflow-hidden p-8 flex flex-col justify-between group cursor-pointer shadow-2xl transition-transform active:scale-[0.99]"
        onClick={onTabFollowing}
      >
        <div className="absolute inset-0 bg-gradient-to-bl from-blue-500/10 via-cyan-500/10 to-emerald-500/10" />
        <div className="absolute inset-0 backdrop-blur-[40px] bg-white/[0.02] border border-white/[0.08] rounded-[32px]" />

        <div className="relative z-10">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md mb-4 shadow-inner ring-1 ring-white/10">
            <Users size={24} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">{t('nav.following')}</h2>
          <p className="text-white/50 font-medium mt-1">
            {fc(user.followings_count)} {t('search.users').toLowerCase()}
          </p>
        </div>

        <div className="relative z-10 mt-auto">
          <div className="flex -space-x-4 overflow-hidden py-2 pl-1">
            {followings.slice(0, 7).map((u) => (
              <div
                key={u.id}
                className="w-14 h-14 rounded-full ring-4 ring-[#121214] bg-neutral-800 overflow-hidden shadow-lg transition-transform group-hover:translate-x-2"
              >
                <img
                  src={art(u.avatar_url, 'small') || ''}
                  className="w-full h-full object-cover"
                  alt=""
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});

/* ── Isolated Tab Content ────────────────────────────────── */

/* Each tab is its own component — only fetches its own data */

const LikesTab = React.memo(function LikesTab({ filter }: { filter: string }) {
  const { t } = useTranslation();
  const likesQuery = useLikedTracks();
  const { tracks: likedTracks, isLoading } = likesQuery;
  const sentinelRef = useInfiniteScroll(
    !!likesQuery.hasNextPage,
    !!likesQuery.isFetchingNextPage,
    likesQuery.fetchNextPage,
  );

  // Auto-fetch remaining pages when filtering
  useEffect(() => {
    if (filter && likesQuery.hasNextPage && !likesQuery.isFetchingNextPage) {
      likesQuery.fetchNextPage();
    }
  }, [filter, likesQuery.hasNextPage, likesQuery.isFetchingNextPage]);

  const filtered = useMemo(() => {
    if (!filter) return likedTracks;
    const q = filter.toLowerCase();
    return likedTracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.user.username.toLowerCase().includes(q),
    );
  }, [likedTracks, filter]);

  const expandQueue = React.useCallback(() => {
    fetchAllLikedTracks().then((all) => {
      usePlayerStore.getState().setQueue(all);
    });
  }, []);

  return (
    <div className="min-h-[400px]">
      <div className="flex flex-col gap-1">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-white/20" />
          </div>
        ) : filtered.length > 0 ? (
          <VirtualList
            items={filtered}
            rowHeight={68}
            overscan={8}
            className="flex flex-col gap-1"
            disabled={filtered.length < 40}
            getItemKey={(track) => track.urn}
            renderItem={(track, i) => (
              <LibraryTrackRow track={track} index={i} queue={filtered} onPlay={expandQueue} />
            )}
          />
        ) : (
          <div className="py-20 text-center text-white/20">
            {filter && likesQuery.hasNextPage
              ? t('common.loading')
              : filter
                ? t('library.noMatches')
                : t('library.noLikedTracks')}
          </div>
        )}
      </div>
      {!filter ? (
        <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
          {likesQuery.isFetchingNextPage && (
            <Loader2 size={20} className="text-white/15 animate-spin" />
          )}
        </div>
      ) : likesQuery.isFetchingNextPage ? (
        <div className="h-12 flex items-center justify-center mt-4">
          <Loader2 size={20} className="text-white/15 animate-spin" />
        </div>
      ) : null}
    </div>
  );
});

const FollowingTab = React.memo(function FollowingTab({ filter }: { filter: string }) {
  const { t } = useTranslation();
  const followingsQuery = useMyFollowings();
  const { users: followings, isLoading } = followingsQuery;
  const sentinelRef = useInfiniteScroll(
    !!followingsQuery.hasNextPage,
    !!followingsQuery.isFetchingNextPage,
    followingsQuery.fetchNextPage,
  );

  // Auto-fetch remaining pages when filtering
  useEffect(() => {
    if (filter && followingsQuery.hasNextPage && !followingsQuery.isFetchingNextPage) {
      followingsQuery.fetchNextPage();
    }
  }, [filter, followingsQuery.hasNextPage, followingsQuery.isFetchingNextPage]);

  const filtered = useMemo(() => {
    if (!filter) return followings;
    const q = filter.toLowerCase();
    return followings.filter((u) => u.username.toLowerCase().includes(q));
  }, [followings, filter]);

  return (
    <div className="min-h-[400px]">
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-white/20" />
        </div>
      ) : filtered.length > 0 ? (
        <VirtualGrid
          items={filtered}
          itemHeight={220}
          minColumnWidth={160}
          gap={16}
          overscan={3}
          disabled={filtered.length < 30}
          getItemKey={(user) => user.urn}
          renderItem={(user) => <UserCard user={user} />}
        />
      ) : (
        <div className="py-20 text-center text-white/20">
          {filter ? t('library.noMatches') : t('library.notFollowing')}
        </div>
      )}
      {!filter && (
        <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
          {followingsQuery.isFetchingNextPage && (
            <Loader2 size={20} className="text-white/15 animate-spin" />
          )}
        </div>
      )}
    </div>
  );
});

const PlaylistsTab = React.memo(function PlaylistsTab({ filter }: { filter: string }) {
  const { t } = useTranslation();
  const myPlaylistsQuery = useMyPlaylists();
  const likedPlaylistsQuery = useMyLikedPlaylists();
  const createdPlaylists = myPlaylistsQuery.playlists;
  const likedPlaylists = likedPlaylistsQuery.playlists;

  const filteredCreated = useMemo(() => {
    if (!filter) return createdPlaylists;
    const q = filter.toLowerCase();
    return createdPlaylists.filter((p) => p.title.toLowerCase().includes(q));
  }, [createdPlaylists, filter]);

  const filteredLiked = useMemo(() => {
    if (!filter) return likedPlaylists;
    const q = filter.toLowerCase();
    return likedPlaylists.filter((p) => p.title.toLowerCase().includes(q));
  }, [likedPlaylists, filter]);

  const hasNextPage = likedPlaylistsQuery.hasNextPage || myPlaylistsQuery.hasNextPage;
  const isFetchingNextPage =
    likedPlaylistsQuery.isFetchingNextPage || myPlaylistsQuery.isFetchingNextPage;
  const fetchNextPage = likedPlaylistsQuery.hasNextPage
    ? likedPlaylistsQuery.fetchNextPage
    : myPlaylistsQuery.fetchNextPage;
  const sentinelRef = useInfiniteScroll(!!hasNextPage, !!isFetchingNextPage, fetchNextPage);

  // Auto-fetch remaining pages when filtering
  useEffect(() => {
    if (filter && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [filter, hasNextPage, isFetchingNextPage]);

  return (
    <div className="min-h-[400px]">
      <div className="space-y-10">
        {myPlaylistsQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-white/20" />
          </div>
        ) : filteredCreated.length > 0 ? (
          <section>
            <h3 className="text-lg font-bold text-white/80 mb-5 px-1">
              {t('library.yourPlaylists')}
            </h3>
            <VirtualGrid
              items={filteredCreated}
              itemHeight={320}
              minColumnWidth={180}
              gap={24}
              overscan={3}
              disabled={filteredCreated.length < 30}
              getItemKey={(playlist) => playlist.urn}
              renderItem={(playlist) => <PlaylistCard playlist={playlist} />}
            />
          </section>
        ) : null}

        {likedPlaylistsQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-white/20" />
          </div>
        ) : filteredLiked.length > 0 ? (
          <section>
            <h3 className="text-lg font-bold text-white/80 mb-5 px-1">
              {t('library.likedPlaylists')}
            </h3>
            <VirtualGrid
              items={filteredLiked}
              itemHeight={320}
              minColumnWidth={180}
              gap={24}
              overscan={3}
              disabled={filteredLiked.length < 30}
              getItemKey={(playlist) => playlist.urn}
              renderItem={(playlist) => <PlaylistCard playlist={playlist} />}
            />
          </section>
        ) : null}

        {!myPlaylistsQuery.isLoading &&
          !likedPlaylistsQuery.isLoading &&
          filteredCreated.length === 0 &&
          filteredLiked.length === 0 && (
            <div className="py-20 text-center text-white/20">
              {filter ? t('library.noMatches') : t('library.noPlaylists')}
            </div>
          )}
      </div>
      {!filter && (
        <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
          {isFetchingNextPage && <Loader2 size={20} className="text-white/15 animate-spin" />}
        </div>
      )}
    </div>
  );
});

/* ── History Tab ──────────────────────────────────────────── */

function formatHistoryDate(dateStr: string, t: (k: string) => string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  if (d >= today) return t('library.today');
  if (d >= yesterday) return t('library.yesterday');
  return t('library.earlier');
}

const HistoryTab = React.memo(function HistoryTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const historyQuery = useHistory();
  const { entries, isLoading } = historyQuery;
  const sentinelRef = useInfiniteScroll(
    !!historyQuery.hasNextPage,
    !!historyQuery.isFetchingNextPage,
    historyQuery.fetchNextPage,
  );

  const handleClearHistory = useCallback(async () => {
    await api('/history', { method: 'DELETE' });
    historyQuery.refetch();
  }, [historyQuery]);

  const rows = useMemo(() => {
    const flat: Array<
      | { type: 'header'; id: string; label: string }
      | { type: 'entry'; id: string; entry: HistoryEntry }
    > = [];
    let currentLabel = '';

    for (const entry of entries) {
      const label = formatHistoryDate(entry.playedAt, t);
      if (label !== currentLabel) {
        currentLabel = label;
        flat.push({ type: 'header', id: `header:${label}`, label });
      }
      flat.push({ type: 'entry', id: entry.id, entry });
    }

    return flat;
  }, [entries, t]);

  return (
    <div className="min-h-[400px]">
      {entries.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleClearHistory}
            className="text-[12px] text-white/30 hover:text-red-400 transition-colors cursor-pointer"
          >
            {t('library.clearHistory')}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-white/20" />
        </div>
      ) : rows.length > 0 ? (
        <VirtualList
          items={rows}
          rowHeight={60}
          overscan={10}
          className="flex flex-col"
          disabled={rows.length < 60}
          getItemKey={(row) => row.id}
          renderItem={(row) =>
            row.type === 'header' ? (
              <div className="py-3">
                <h3 className="text-[13px] font-bold text-white/30 uppercase tracking-wider px-1">
                  {row.label}
                </h3>
              </div>
            ) : (
              <div className="group flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-white/[0.04] transition-all duration-300">
                <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.08] shadow-md">
                  {row.entry.artworkUrl ? (
                    <img
                      src={row.entry.artworkUrl.replace('large', 't200x200')}
                      alt=""
                      className="w-full h-full object-cover"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.05] to-transparent">
                      <Music size={14} className="text-white/20" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p
                    className="text-[14px] font-medium truncate text-white/90 hover:text-white cursor-pointer transition-colors"
                    onClick={() => navigate(`/track/${encodeURIComponent(row.entry.scTrackId)}`)}
                  >
                    {row.entry.title}
                  </p>
                  <p className="text-[12px] text-white/40 truncate mt-0.5">
                    {row.entry.artistName}
                  </p>
                </div>

                <span className="text-[11px] text-white/20 tabular-nums shrink-0">
                  {new Date(row.entry.playedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )
          }
        />
      ) : (
        <div className="py-20 text-center text-white/20">{t('library.historyEmpty')}</div>
      )}

      <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
        {historyQuery.isFetchingNextPage && (
          <Loader2 size={20} className="text-white/15 animate-spin" />
        )}
      </div>
    </div>
  );
});

export const Library = React.memo(() => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as
    | 'playlists'
    | 'likes'
    | 'following'
    | 'history'
    | null;
  const [activeTab, setActiveTab] = useState<'playlists' | 'likes' | 'following' | 'history'>(
    tabParam || 'likes',
  );
  const [filter, setFilter] = useState('');

  // Sync tab from URL param
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) setActiveTab(tabParam);
  }, [tabParam]);
  const deferredFilter = useDeferredValue(filter);

  const user = useAuthStore((s) => s.user);

  const onTabLikes = React.useCallback(() => setActiveTab('likes'), []);
  const onTabFollowing = React.useCallback(() => setActiveTab('following'), []);

  const tabs = [
    { id: 'playlists', label: t('search.playlists') },
    { id: 'likes', label: t('library.likedTracks') },
    { id: 'following', label: t('nav.following') },
    { id: 'history', label: t('library.history') },
  ] as const;

  if (!user) return null;

  return (
    <div className="p-6 pb-4 space-y-8">
      <LibraryHero onTabLikes={onTabLikes} onTabFollowing={onTabFollowing} />

      {/* Tabs + Search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 p-1.5 bg-white/[0.02] border border-white/[0.05] rounded-2xl w-fit backdrop-blur-2xl shadow-lg">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setFilter('');
                }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300 ease-[var(--ease-apple)] ${
                  isActive
                    ? 'bg-white/[0.12] text-white shadow-md border border-white/[0.05]'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <SearchIcon size={15} className="text-white/30" />
          </div>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('library.filter')}
            className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] text-white/80 placeholder:text-white/25 text-[13px] py-2.5 pl-9 pr-8 rounded-xl outline-none border border-white/[0.05] focus:border-white/[0.12] transition-all duration-200"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="absolute inset-y-0 right-2 flex items-center text-white/30 hover:text-white/60 cursor-pointer transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {activeTab === 'likes' && <LikesTab filter={deferredFilter} />}
      {activeTab === 'following' && <FollowingTab filter={deferredFilter} />}
      {activeTab === 'playlists' && <PlaylistsTab filter={deferredFilter} />}

      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
});
