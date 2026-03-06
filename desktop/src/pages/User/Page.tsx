import {
  AlertCircle,
  Calendar,
  Globe,
  Instagram,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Twitter,
  Users,
  Youtube,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  useUser,
  useUserLikedTracks,
  useUserPlaylists,
  useUserTracks,
  useUserWebProfiles,
} from '../../api/index.ts';
import { PlaylistCard } from '../../components/common/PlaylistCard.tsx';
import { ScdnImg } from '../../components/common/ScdnImg.tsx';
import { SegmentedTabs } from '../../components/common/SegmentedTabs.tsx';
import { TrackRow } from '../../components/track/TrackRow.tsx';
import { useInfiniteScroll } from '../../lib/useInfiniteScroll.ts';
import { dateFormatted, replaceArtSize, toCompactCount } from '../../lib/utils.ts';
import { useAuthStore } from '../../stores/auth.ts';
import { UserFollowButton } from './UserFollowButton.tsx';

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
type TabsId = 'tracks' | 'playlists' | 'likes';

export function UserPage() {
  const { urn } = useParams<{ urn: string }>();
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<TabsId>('tracks');

  // Profile data
  const { data: user, isLoading: userLoading } = useUser(urn);
  const { data: webProfiles } = useUserWebProfiles(urn);

  // Tab data
  const tracksQuery = useUserTracks(urn);
  const playlistsQuery = useUserPlaylists(urn);
  const likesQuery = useUserLikedTracks(urn);

  // Infinite scroll
  const hasNextPage =
    activeTab === 'tracks'
      ? tracksQuery.hasNextPage
      : activeTab === 'playlists'
        ? playlistsQuery.hasNextPage
        : likesQuery.hasNextPage;

  const isFetchingNextPage =
    activeTab === 'tracks'
      ? tracksQuery.isFetchingNextPage
      : activeTab === 'playlists'
        ? playlistsQuery.isFetchingNextPage
        : likesQuery.isFetchingNextPage;

  const fetchNextPage =
    activeTab === 'tracks'
      ? tracksQuery.fetchNextPage
      : activeTab === 'playlists'
        ? playlistsQuery.fetchNextPage
        : likesQuery.fetchNextPage;

  const sentinelRef = useInfiniteScroll(!!hasNextPage, !!isFetchingNextPage, fetchNextPage);

  if (userLoading || !user) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={28} className="text-accent animate-spin" />
      </div>
    );
  }

  const avatar = replaceArtSize(user.avatar_url, 't500x500');
  const isOwnProfile = currentUser?.urn === user.urn;

  const tabs: { id: TabsId; label: string; count: number }[] = [
    { id: 'tracks', label: t('user.tracks'), count: user.track_count || 0 },
    {
      id: 'playlists',
      label: t('user.playlists'),
      count: user.playlist_count || 0,
    },
    {
      id: 'likes',
      label: t('user.likes'),
      count: user.public_favorites_count || 0,
    },
  ] as const;

  const renderTabContent = () => {
    if (activeTab === 'tracks') {
      if (tracksQuery.isLoading)
        return (
          <div className="py-12 flex justify-center">
            <Loader2 size={24} className="animate-spin text-white/20" />
          </div>
        );

      const uniqueTracks = Array.from(new Map(tracksQuery.tracks.map((t) => [t.urn, t])).values());
      if (uniqueTracks.length === 0)
        return <div className="py-12 text-center text-white/30 text-sm">No tracks found.</div>;

      return (
        <div className="flex flex-col gap-1">
          {uniqueTracks.map((track, i) => (
            <TrackRow key={`${track.urn}-${i}`} track={track} index={i} queue={uniqueTracks} />
          ))}
        </div>
      );
    }

    if (activeTab === 'playlists') {
      if (playlistsQuery.isLoading)
        return (
          <div className="py-12 flex justify-center">
            <Loader2 size={24} className="animate-spin text-white/20" />
          </div>
        );

      const uniquePlaylists = Array.from(
        new Map(playlistsQuery.playlists.map((p) => [p.urn, p])).values(),
      );
      if (uniquePlaylists.length === 0)
        return <div className="py-12 text-center text-white/30 text-sm">No playlists found.</div>;

      return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-6">
          {uniquePlaylists.map((playlist, i) => (
            <PlaylistCard key={`${playlist.urn}-${i}`} playlist={playlist} />
          ))}
        </div>
      );
    }

    if (activeTab === 'likes') {
      if (likesQuery.isLoading)
        return (
          <div className="py-12 flex justify-center">
            <Loader2 size={24} className="animate-spin text-white/20" />
          </div>
        );

      const uniqueLikes = Array.from(new Map(likesQuery.tracks.map((t) => [t.urn, t])).values());
      if (uniqueLikes.length === 0)
        return <div className="py-12 text-center text-white/30 text-sm">No liked tracks.</div>;

      return (
        <div className="flex flex-col gap-1">
          {uniqueLikes.map((track, i) => (
            <TrackRow key={`${track.urn}-${i}`} track={track} index={i} queue={uniqueLikes} />
          ))}
        </div>
      );
    }
  };

  return (
    <div className="p-6 pb-4 space-y-8 animate-fade-in-up">
      {/* ── Public Profile Warning ── */}
      {isOwnProfile && (
        <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 text-amber-400/90 px-5 py-3.5 rounded-2xl flex items-center gap-3 text-[13px] font-medium backdrop-blur-xl shadow-lg">
          <AlertCircle size={18} />
          {t('user.publicProfile')}
        </div>
      )}

      {/* ── Hero Section (Vision Pro Style) ── */}
      <section className="relative rounded-[32px] overflow-hidden bg-white/[0.02] border border-white/[0.05] shadow-2xl">
        {/* Deep blur background */}
        {avatar && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <ScdnImg
              src={avatar}
              alt=""
              className="w-full h-full object-cover scale-[2] blur-[100px] opacity-30 saturate-200"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[rgb(8,8,10)]/50 via-[rgb(8,8,10)]/40 to-[rgb(8,8,10)]/90" />
          </div>
        )}

        <div className="relative flex flex-col md:flex-row items-center md:items-end gap-8 p-8 md:p-10">
          {/* Avatar */}
          <div className="w-[180px] h-[180px] md:w-[200px] md:h-[200px] rounded-full overflow-hidden shrink-0 shadow-[0_0_60px_rgba(0,0,0,0.6)] ring-2 ring-white/[0.15] bg-black/40 relative group">
            {avatar ? (
              <ScdnImg
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

          {/* User Info */}
          <div className="flex-1 min-w-0 flex flex-col items-center md:items-start text-center md:text-left">
            {user.plan && user.plan !== 'Free' && (
              <span className="inline-block text-[10px] font-extrabold px-3 py-1 rounded-full bg-gradient-to-r from-accent to-accent-hover text-white shadow-[0_0_20px_var(--color-accent-glow)] mb-4 uppercase tracking-widest">
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
                    {toCompactCount(user.followers_count)}
                  </span>
                  <span className="text-[11px] text-white/40 uppercase tracking-widest mt-1 font-semibold">
                    {t('user.followers')}
                  </span>
                </div>
              )}
              {user.followings_count != null && (
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-white/90 tabular-nums">
                    {toCompactCount(user.followings_count)}
                  </span>
                  <span className="text-[11px] text-white/40 uppercase tracking-widest mt-1 font-semibold">
                    {t('user.following')}
                  </span>
                </div>
              )}

              {!isOwnProfile && (
                <div className="ml-auto">
                  <UserFollowButton userUrn={user.urn} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Two Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Left Column (Main Content) */}
        <div className="min-w-0 flex flex-col gap-6">
          {/* Apple-style Segmented Control for Tabs */}
          <SegmentedTabs
            items={tabs}
            value={activeTab}
            onChange={setActiveTab}
            align="start"
            className="mx-auto md:mx-0"
          />

          {/* Grid/List Content */}
          <div className="min-h-[400px]">
            {renderTabContent()}

            {/* Infinite Scroll Sentinel */}
            <div ref={sentinelRef} className="h-16 flex items-center justify-center mt-6">
              {isFetchingNextPage && <Loader2 size={24} className="text-white/20 animate-spin" />}
            </div>
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-5 lg:sticky lg:top-6">
          {/* Bio / Description */}
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

          {/* Stats & Joined */}
          <section className="bg-white/[0.02] border border-white/[0.05] backdrop-blur-[60px] rounded-3xl p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-white/40 font-medium">{t('user.memberSince')}</span>
              <span className="text-white/80 font-semibold flex items-center gap-2">
                <Calendar size={14} className="text-white/30" />
                {dateFormatted(user.created_at)}
              </span>
            </div>
          </section>

          {/* Web Profiles (Social Links) */}
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
