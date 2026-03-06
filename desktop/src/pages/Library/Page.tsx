import { Heart, Loader2, Play, Users } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useLikedTracks,
  useMyFollowings,
  useMyLikedPlaylists,
  useMyPlaylists,
} from '../../api/index.ts';
import { PlaylistCard } from '../../components/common/PlaylistCard.tsx';
import { ScdnImg } from '../../components/common/ScdnImg.tsx';
import { SegmentedTabs } from '../../components/common/SegmentedTabs.tsx';
import { TrackRow } from '../../components/track/TrackRow.tsx';
import { UserCard } from '../../components/user/UserCard.tsx';
import { useQueuePlayback } from '../../features/playback/index.ts';
import { replaceArtSize, toCompactCount } from '../../lib/utils.ts';
import { useAuthStore } from '../../stores/auth.ts';

type TabsId = 'playlists' | 'likes' | 'following';

const LibraryBase = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabsId>('likes');
  const user = useAuthStore((s) => s.user);

  // Data Fetching
  const { data: likedTracksData, isLoading: likesLoading } = useLikedTracks(200);
  const { data: followingsData, isLoading: followingsLoading } = useMyFollowings(50);
  const { data: likedPlaylistsData, isLoading: likedPlaylistsLoading } = useMyLikedPlaylists(50);
  const { data: myPlaylists, isLoading: myPlaylistsLoading } = useMyPlaylists();

  const likedTracks = likedTracksData?.collection || [];
  const followings = followingsData?.collection || [];
  const likedPlaylists = likedPlaylistsData?.collection || [];
  const createdPlaylists = myPlaylists || [];

  const { shufflePlay } = useQueuePlayback(likedTracks);

  const tabs: { id: TabsId; label: string }[] = [
    { id: 'playlists', label: t('search.playlists') },
    { id: 'likes', label: t('library.likedTracks') },
    { id: 'following', label: t('nav.following') },
  ];

  if (!user) return null;

  return (
    <div className="p-6 pb-4 space-y-8 animate-fade-in-up">
      {/* ── Hero Section (Bento Grid) ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Liked Tracks Card */}
        <div
          className="relative h-[240px] rounded-[32px] overflow-hidden p-8 flex flex-col justify-between group cursor-pointer shadow-2xl transition-transform active:scale-[0.99]"
          onClick={() => setActiveTab('likes')}
        >
          {/* Background */}
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
              {toCompactCount(user.public_favorites_count)} {t('search.tracks').toLowerCase()}
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
                    src={replaceArtSize(track.artwork_url, 'small') || ''}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                </div>
              ))}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                shufflePlay();
              }}
              className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              <Play size={20} fill="black" className="ml-1" />
            </button>
          </div>
        </div>

        {/* Following Card */}
        <div
          className="relative h-[240px] rounded-[32px] overflow-hidden p-8 flex flex-col justify-between group cursor-pointer shadow-2xl transition-transform active:scale-[0.99]"
          onClick={() => setActiveTab('following')}
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-bl from-blue-500/10 via-cyan-500/10 to-emerald-500/10" />
          <div className="absolute inset-0 backdrop-blur-[40px] bg-white/[0.02] border border-white/[0.08] rounded-[32px]" />

          <div className="relative z-10">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md mb-4 shadow-inner ring-1 ring-white/10">
              <Users size={24} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">{t('nav.following')}</h2>
            <p className="text-white/50 font-medium mt-1">
              {toCompactCount(user.followings_count)} {t('search.users').toLowerCase()}
            </p>
          </div>

          <div className="relative z-10 mt-auto">
            <div className="flex -space-x-4 overflow-hidden py-2 pl-1">
              {followings.slice(0, 7).map((u) => (
                <div
                  key={u.id}
                  className="w-14 h-14 rounded-full ring-4 ring-[#121214] bg-neutral-800 overflow-hidden shadow-lg transition-transform group-hover:translate-x-2"
                >
                  <ScdnImg
                    src={replaceArtSize(u.avatar_url, 'small') || ''}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SegmentedTabs
        items={tabs}
        value={activeTab}
        onChange={setActiveTab}
        align="start"
        className="mx-auto md:mx-0"
      />

      {/* ── Content ── */}
      <div className="min-h-[400px]">
        {/* Playlists Tab */}
        {activeTab === 'playlists' && (
          <div className="space-y-10 animate-fade-in-up">
            {/* Created Playlists */}
            {myPlaylistsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={24} className="animate-spin text-white/20" />
              </div>
            ) : Array.isArray(createdPlaylists) && createdPlaylists.length > 0 ? (
              <section>
                <h3 className="text-lg font-bold text-white/80 mb-5 px-1">
                  {t('library.yourPlaylists')}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {createdPlaylists.map((p) => (
                    <PlaylistCard key={p.urn} playlist={p} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Liked Playlists */}
            {likedPlaylistsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={24} className="animate-spin text-white/20" />
              </div>
            ) : likedPlaylists.length > 0 ? (
              <section>
                <h3 className="text-lg font-bold text-white/80 mb-5 px-1">
                  {t('library.likedPlaylists')}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {likedPlaylists.map((p) => (
                    <PlaylistCard key={p.urn} playlist={p} />
                  ))}
                </div>
              </section>
            ) : (
              createdPlaylists.length === 0 && (
                <div className="py-20 text-center text-white/20">No playlists found</div>
              )
            )}
          </div>
        )}

        {/* Likes Tab */}
        {activeTab === 'likes' && (
          <div className="flex flex-col gap-1 animate-fade-in-up">
            {likesLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 size={32} className="animate-spin text-white/20" />
              </div>
            ) : likedTracks.length > 0 ? (
              likedTracks.map((track, i) => (
                <TrackRow
                  key={track.urn}
                  track={track}
                  index={i}
                  queue={likedTracks}
                  source={'liked'}
                />
              ))
            ) : (
              <div className="py-20 text-center text-white/20">No liked tracks yet</div>
            )}
          </div>
        )}

        {/* Following Tab */}
        {activeTab === 'following' && (
          <div className="animate-fade-in-up">
            {followingsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 size={32} className="animate-spin text-white/20" />
              </div>
            ) : followings.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {followings.map((u) => (
                  <UserCard key={u.urn} user={u} />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-white/20">You are not following anyone</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export const Library = React.memo(LibraryBase);
