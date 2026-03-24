import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AddToPlaylistDialog } from '../components/music/AddToPlaylistDialog';
import { LikeButton } from '../components/music/LikeButton';
import { PlaylistCard } from '../components/music/PlaylistCard';
import { Avatar } from '../components/ui/Avatar';
import { CopyLinkButton } from '../components/ui/CopyLinkButton';
import { VirtualGrid } from '../components/ui/VirtualGrid';
import { VirtualList } from '../components/ui/VirtualList';
import { api } from '../lib/api';
import { preloadTrack } from '../lib/audio';
import { art, dur, fc } from '../lib/formatters';
import {
  useInfiniteScroll,
  useUser,
  useUserFollowers,
  useUserFollowings,
  useUserLikedTracks,
  useUserPlaylists,
  useUserPopularTracks,
  useUserTracks,
  useUserWebProfiles,
} from '../lib/hooks';
import {
  AlertCircle,
  Calendar,
  Globe,
  headphones11,
  heart11,
  Instagram,
  LinkIcon,
  ListPlus,
  Loader2,
  MapPin,
  Music,
  pauseWhite14,
  playWhite14,
  Twitter,
  Users,
  Youtube,
} from '../lib/icons';
import { useTrackPlay } from '../lib/useTrackPlay';
import { useAuthStore } from '../stores/auth';
import type { Track } from '../stores/player';

/* ── Helpers ──────────────────────────────────────────────── */

function dateFormattedLong(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(/\//g, '-').replace(' +0000', 'Z'));
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });
}

function getWebIcon(service: string) {
  switch (service.toLowerCase()) {
    case 'instagram':
      return <Instagram size={14} />;
    case 'twitter':
      return <Twitter size={14} />;
    case 'youtube':
      return <Youtube size={14} />;
    case 'personal':
      return <Globe size={14} />;
    default:
      return <LinkIcon size={14} />;
  }
}

/* ── Follow Button ────────────────────────────────────────── */

function FollowBtn({ userUrn }: { userUrn: string }) {
  const { t } = useTranslation();

  const currentUser = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { data: initialFollowing = false, isLoading: isQueryLoading } = useQuery({
    queryKey: ['following', currentUser?.urn, userUrn],
    queryFn: () =>
      api<boolean>(
        `/users/${encodeURIComponent(currentUser!.urn)}/followings/${encodeURIComponent(userUrn)}`,
      ),
    enabled: !!currentUser?.urn && !!userUrn,
  });

  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  const toggle = async () => {
    setLoading(true);
    const next = !following;
    setFollowing(next);
    try {
      await api(`/me/followings/${encodeURIComponent(userUrn)}`, {
        method: next ? 'PUT' : 'DELETE',
      });
      qc.invalidateQueries({ queryKey: ['following', currentUser?.urn, userUrn] });
      qc.invalidateQueries({ queryKey: ['user', userUrn] });
      qc.invalidateQueries({ queryKey: ['me', 'followings'] });
    } catch (_e) {
      // Revert on failure
      setFollowing(!next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading || isQueryLoading}
      className={`cursor-pointer inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-[var(--ease-apple)] shadow-xl disabled:opacity-50 ${
        following
          ? 'bg-white/[0.08] text-white hover:bg-white/[0.12] border border-white/[0.08]'
          : 'bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
      }`}
    >
      {loading || isQueryLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : following ? (
        t('user.following')
      ) : (
        t('user.follow')
      )}
    </button>
  );
}

/* ── Track Row (For Tracks & Likes) ───────────────────────── */

const TrackRow = React.memo(
  ({ track, index, queue }: { track: Track; index: number; queue: Track[] }) => {
    const navigate = useNavigate();
    const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
    const cover = art(track.artwork_url, 't200x200');

    return (
      <div
        className={`group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 ease-[var(--ease-apple)] select-none ${
          isThis
            ? 'bg-accent/[0.06] ring-1 ring-accent/20 shadow-[inset_0_0_20px_rgba(255,85,0,0.05)]'
            : 'hover:bg-white/[0.04]'
        }`}
        onMouseEnter={() => preloadTrack(track.urn)}
      >
        {/* Index & Play */}
        <div
          className="w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer"
          onClick={togglePlay}
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

        {/* Artwork */}
        <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.08] shadow-md">
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" decoding="async" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.05] to-transparent">
              <Music size={14} className="text-white/20" />
            </div>
          )}
        </div>

        {/* Title & Artist */}
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

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-4 shrink-0 pr-4">
          {track.playback_count != null && (
            <span className="text-[11px] text-white/30 tabular-nums flex items-center gap-1.5 w-16">
              {headphones11}
              {fc(track.playback_count)}
            </span>
          )}
          {(track.favoritings_count ?? track.likes_count) != null && (
            <span className="text-[11px] text-white/30 tabular-nums flex items-center gap-1.5 w-14">
              {heart11}
              {fc(track.favoritings_count ?? track.likes_count)}
            </span>
          )}
        </div>

        {/* Like + Add to playlist */}
        <div className="flex items-center gap-0.5 shrink-0">
          <LikeButton track={track} />
          <AddToPlaylistDialog trackUrns={[track.urn]}>
            <button
              type="button"
              className="cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center text-white/20 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
            >
              <ListPlus size={14} />
            </button>
          </AddToPlaylistDialog>
        </div>

        {/* Duration */}
        <span className="text-[12px] text-white/30 tabular-nums font-medium shrink-0 w-12 text-right">
          {dur(track.duration)}
        </span>
      </div>
    );
  },
  (prev, next) =>
    prev.track.urn === next.track.urn &&
    prev.index === next.index &&
    prev.track.user_favorite === next.track.user_favorite,
);

/* ── Isolated Tab Content ────────────────────────────────── */

/* Each user tab is its own component — only fetches its own data */

const UserTracksTab = React.memo(function UserTracksTab({ urn }: { urn: string }) {
  const tracksQuery = useUserTracks(urn);
  const sentinelRef = useInfiniteScroll(
    !!tracksQuery.hasNextPage,
    !!tracksQuery.isFetchingNextPage,
    tracksQuery.fetchNextPage,
  );

  return (
    <div className="min-h-[400px]">
      {tracksQuery.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 size={24} className="animate-spin text-white/20" />
        </div>
      ) : tracksQuery.tracks.length === 0 ? (
        <div className="py-12 text-center text-white/30 text-sm">No tracks found.</div>
      ) : (
        <VirtualList
          items={tracksQuery.tracks}
          rowHeight={68}
          overscan={8}
          className="flex flex-col gap-1"
          getItemKey={(track) => track.urn}
          renderItem={(track, i) => <TrackRow track={track} index={i} queue={tracksQuery.tracks} />}
        />
      )}
      <div ref={sentinelRef} className="h-16 flex items-center justify-center mt-6">
        {tracksQuery.isFetchingNextPage && (
          <Loader2 size={24} className="text-white/20 animate-spin" />
        )}
      </div>
    </div>
  );
});

const UserPopularTab = React.memo(function UserPopularTab({ urn }: { urn: string }) {
  const { data, isLoading } = useUserPopularTracks(urn);
  const allTracks = data ?? [];

  return (
    <div className="min-h-[400px]">
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 size={24} className="animate-spin text-white/20" />
        </div>
      ) : allTracks.length === 0 ? (
        <div className="py-12 text-center text-white/30 text-sm">No popular tracks found.</div>
      ) : (
        <VirtualList
          items={allTracks}
          rowHeight={68}
          overscan={8}
          className="flex flex-col gap-1"
          getItemKey={(track) => track.urn}
          renderItem={(track, i) => <TrackRow track={track} index={i} queue={allTracks} />}
        />
      )}
    </div>
  );
});

const UserPlaylistsTab = React.memo(function UserPlaylistsTab({ urn }: { urn: string }) {
  const { t } = useTranslation();
  const playlistsQuery = useUserPlaylists(urn);
  const sentinelRef = useInfiniteScroll(
    !!playlistsQuery.hasNextPage,
    !!playlistsQuery.isFetchingNextPage,
    playlistsQuery.fetchNextPage,
  );

  return (
    <div className="min-h-[400px]">
      {playlistsQuery.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 size={24} className="animate-spin text-white/20" />
        </div>
      ) : playlistsQuery.playlists.length === 0 ? (
        <div className="py-12 text-center text-white/30 text-sm">
          {t('playlist.noPlaylists', 'No playlists found.')}
        </div>
      ) : (
        <VirtualGrid
          items={playlistsQuery.playlists}
          itemHeight={320}
          minColumnWidth={180}
          gap={24}
          overscan={3}
          getItemKey={(playlist, i) => `${playlist.urn}-${i}`}
          renderItem={(playlist) => <PlaylistCard playlist={playlist} showPlayback />}
        />
      )}
      <div ref={sentinelRef} className="h-16 flex items-center justify-center mt-6">
        {playlistsQuery.isFetchingNextPage && (
          <Loader2 size={24} className="text-white/20 animate-spin" />
        )}
      </div>
    </div>
  );
});

const UserLikesTab = React.memo(function UserLikesTab({ urn }: { urn: string }) {
  const likesQuery = useUserLikedTracks(urn);
  const sentinelRef = useInfiniteScroll(
    !!likesQuery.hasNextPage,
    !!likesQuery.isFetchingNextPage,
    likesQuery.fetchNextPage,
  );

  return (
    <div className="min-h-[400px]">
      {likesQuery.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 size={24} className="animate-spin text-white/20" />
        </div>
      ) : likesQuery.tracks.length === 0 ? (
        <div className="py-12 text-center text-white/30 text-sm">No liked tracks.</div>
      ) : (
        <VirtualList
          items={likesQuery.tracks}
          rowHeight={68}
          overscan={8}
          className="flex flex-col gap-1"
          getItemKey={(track) => track.urn}
          renderItem={(track, i) => <TrackRow track={track} index={i} queue={likesQuery.tracks} />}
        />
      )}
      <div ref={sentinelRef} className="h-16 flex items-center justify-center mt-6">
        {likesQuery.isFetchingNextPage && (
          <Loader2 size={24} className="text-white/20 animate-spin" />
        )}
      </div>
    </div>
  );
});

const UserConnectionsGrid = React.memo(function UserConnectionsGrid({
  users,
}: {
  users: Array<{
    urn: string;
    username: string;
    avatar_url: string;
    followers_count?: number;
  }>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <VirtualGrid
      items={users}
      itemHeight={184}
      minColumnWidth={160}
      gap={16}
      overscan={3}
      getItemKey={(user) => user.urn}
      renderItem={(user) => (
        <div
          onClick={() => navigate(`/user/${encodeURIComponent(user.urn)}`)}
          className="h-full group flex flex-col items-center gap-3 p-5 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.08] transition-all duration-300 ease-[var(--ease-apple)] cursor-pointer shadow-lg hover:shadow-xl"
        >
          <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/[0.08] group-hover:ring-white/[0.15] transition-all duration-300 shadow-lg">
            <Avatar src={user.avatar_url} alt={user.username} size={80} />
          </div>
          <div className="text-center min-w-0 w-full">
            <p className="text-[13px] font-semibold text-white/80 truncate group-hover:text-white transition-colors">
              {user.username}
            </p>
            {user.followers_count != null && (
              <p className="text-[11px] text-white/30 mt-1 tabular-nums">
                {fc(user.followers_count)} {t('user.followers').toLowerCase()}
              </p>
            )}
          </div>
        </div>
      )}
    />
  );
});

const UserConnectionsTab = React.memo(function UserConnectionsTab({
  urn,
  mode,
}: {
  urn: string;
  mode: 'followers' | 'followings';
}) {
  const { t } = useTranslation();
  const query = mode === 'followers' ? useUserFollowers(urn) : useUserFollowings(urn);
  const sentinelRef = useInfiniteScroll(
    !!query.hasNextPage,
    !!query.isFetchingNextPage,
    query.fetchNextPage,
  );

  return (
    <div className="min-h-[400px]">
      {query.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 size={24} className="animate-spin text-white/20" />
        </div>
      ) : query.users.length === 0 ? (
        <div className="py-12 text-center text-white/30 text-sm">
          {mode === 'followers'
            ? t('user.noFollowers', 'No followers found.')
            : t('user.noFollowings', 'No followings found.')}
        </div>
      ) : (
        <UserConnectionsGrid users={query.users} />
      )}
      <div ref={sentinelRef} className="h-16 flex items-center justify-center mt-6">
        {query.isFetchingNextPage && <Loader2 size={24} className="text-white/20 animate-spin" />}
      </div>
    </div>
  );
});

/* ── Main: UserPage ──────────────────────────────────────── */

export function UserPage() {
  const { urn } = useParams<{ urn: string }>();
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<
    'popular' | 'tracks' | 'playlists' | 'likes' | 'following' | 'followers'
  >('popular');

  const { data: user, isLoading: userLoading } = useUser(urn);
  const { data: webProfiles } = useUserWebProfiles(urn);

  if (userLoading || !user) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={28} className="text-accent animate-spin" />
      </div>
    );
  }

  const avatar = art(user.avatar_url, 't500x500');
  const isOwnProfile = currentUser?.urn === user.urn;

  const tabs = [
    { id: 'popular', label: t('user.popular', 'Popular'), count: undefined as number | undefined },
    { id: 'tracks', label: t('user.tracks'), count: user.track_count },
    { id: 'playlists', label: t('user.playlists'), count: user.playlist_count },
    { id: 'likes', label: t('user.likes'), count: user.public_favorites_count },
    { id: 'followers', label: t('user.followers'), count: user.followers_count },
    { id: 'following', label: t('user.following'), count: user.followings_count },
  ] as const;

  return (
    <div className="p-6 pb-4 space-y-8">
      {isOwnProfile && (
        <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 text-amber-400/90 px-5 py-3.5 rounded-2xl flex items-center gap-3 text-[13px] font-medium backdrop-blur-xl shadow-lg">
          <AlertCircle size={18} />
          {t('user.publicProfile')}
        </div>
      )}

      {/* Hero Section */}
      <section className="relative rounded-[32px] overflow-hidden bg-white/[0.02] border border-white/[0.05] shadow-2xl">
        {avatar && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <img
              src={avatar}
              alt=""
              className="absolute left-1/2 top-1/2 min-w-full min-h-full max-w-none -translate-x-1/2 -translate-y-1/2 object-cover scale-[2.2] blur-[110px] opacity-30 saturate-200"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[rgb(8,8,10)]/50 via-[rgb(8,8,10)]/40 to-[rgb(8,8,10)]/90" />
          </div>
        )}

        <div className="relative flex flex-col md:flex-row items-center md:items-end gap-8 p-8 md:p-10">
          <div className="w-[180px] h-[180px] md:w-[200px] md:h-[200px] rounded-full overflow-hidden shrink-0 shadow-[0_0_60px_rgba(0,0,0,0.6)] ring-2 ring-white/[0.15] bg-black/40 relative group">
            {avatar ? (
              <img
                src={avatar}
                alt={user.username}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.05] to-transparent">
                <Users size={64} className="text-white/20" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col items-center md:items-start text-center md:text-left">
            {user.plan && user.plan !== 'Free' && (
              <span className="inline-block text-[10px] font-extrabold px-3 py-1 rounded-full bg-accent text-accent-contrast ring-1 ring-black/10 shadow-[0_0_20px_var(--color-accent-glow)] mb-4 uppercase tracking-widest">
                {user.plan}
              </span>
            )}

            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-2 drop-shadow-xl">
              {user.username}
            </h1>

            {(user.full_name || user.city || user.country) && (
              <p className="text-[15px] text-white/60 mb-6 flex flex-col md:flex-row items-center gap-2 md:gap-4 font-medium">
                {user.full_name && <span>{user.full_name}</span>}
                {user.full_name && (user.city || user.country) && (
                  <span className="hidden md:inline text-white/20">•</span>
                )}
                {(user.city || user.country) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-white/40" />
                    {[user.city, user.country].filter(Boolean).join(', ')}
                  </span>
                )}
              </p>
            )}

            <div className="flex items-center flex-wrap justify-center md:justify-start gap-8 mt-auto w-full">
              {user.followers_count != null && (
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white/90 tabular-nums">
                    {fc(user.followers_count)}
                  </span>
                  <span className="text-[11px] text-white/40 uppercase tracking-widest mt-1 font-semibold">
                    {t('user.followers')}
                  </span>
                </div>
              )}
              {user.followings_count != null && (
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white/90 tabular-nums">
                    {fc(user.followings_count)}
                  </span>
                  <span className="text-[11px] text-white/40 uppercase tracking-widest mt-1 font-semibold">
                    {t('user.following')}
                  </span>
                </div>
              )}

              <div className="ml-auto flex items-center gap-3">
                <CopyLinkButton url={user.permalink_url} />
                {!isOwnProfile && <FollowBtn userUrn={user.urn} />}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
        <div className="min-w-0 flex flex-col gap-6">
          <div className="w-full overflow-x-auto">
            <div className="inline-flex min-w-full md:min-w-0 items-center gap-1.5 p-1.5 bg-white/[0.02] border border-white/[0.05] rounded-2xl backdrop-blur-2xl shadow-lg">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300 ease-[var(--ease-apple)] ${
                      isActive
                        ? 'bg-white/[0.12] text-white shadow-md border border-white/[0.05]'
                        : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04] border border-transparent cursor-pointer'
                    }`}
                  >
                    {tab.label}
                    {tab.count != null && (
                      <span
                        className={`text-[11px] tabular-nums px-2 py-0.5 rounded-full transition-colors ${
                          isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-white/30'
                        }`}
                      >
                        {fc(tab.count)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Each tab only fetches its own data */}
          {activeTab === 'popular' && <UserPopularTab urn={urn!} />}
          {activeTab === 'tracks' && <UserTracksTab urn={urn!} />}
          {activeTab === 'playlists' && <UserPlaylistsTab urn={urn!} />}
          {activeTab === 'likes' && <UserLikesTab urn={urn!} />}
          {activeTab === 'followers' && <UserConnectionsTab urn={urn!} mode="followers" />}
          {activeTab === 'following' && <UserConnectionsTab urn={urn!} mode="followings" />}
        </div>

        {/* Sidebar */}
        <div className="space-y-5 lg:sticky lg:top-6">
          {user.description && (
            <section className="bg-white/[0.02] border border-white/[0.05] backdrop-blur-[60px] rounded-3xl p-6 shadow-xl">
              <h3 className="text-[14px] font-bold text-white/60 mb-4 tracking-tight">
                {t('user.about')}
              </h3>
              <p className="text-[13px] text-white/50 leading-relaxed whitespace-pre-wrap break-words">
                {user.description}
              </p>
            </section>
          )}

          {user.created_at && new Date(user.created_at).getFullYear() > 1970 && (
            <section className="bg-white/[0.02] border border-white/[0.05] backdrop-blur-[60px] rounded-3xl p-6 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-white/40 font-medium">{t('user.memberSince')}</span>
                <span className="text-white/80 font-semibold flex items-center gap-2">
                  <Calendar size={14} className="text-white/30" />
                  {dateFormattedLong(user.created_at)}
                </span>
              </div>
            </section>
          )}

          {webProfiles && webProfiles.length > 0 && (
            <section className="bg-white/[0.02] border border-white/[0.05] backdrop-blur-[60px] rounded-3xl p-6 shadow-xl">
              <h3 className="text-[14px] font-bold text-white/60 mb-4 tracking-tight">
                {t('user.links')}
              </h3>
              <div className="flex flex-col gap-1.5">
                {webProfiles.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.06] transition-all duration-200 group/link border border-transparent hover:border-white/[0.04]"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center text-white/40 group-hover/link:text-white group-hover/link:bg-white/[0.1] group-hover:scale-105 transition-all duration-300 shadow-sm">
                      {getWebIcon(link.service)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white/80 font-semibold truncate group-hover/link:text-white transition-colors">
                        {link.title}
                      </p>
                      {link.username && (
                        <p className="text-[11px] text-white/30 truncate mt-0.5 font-medium">
                          @{link.username}
                        </p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
