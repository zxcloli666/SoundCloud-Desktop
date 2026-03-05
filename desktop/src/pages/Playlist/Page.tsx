import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Shuffle, Loader2, ListMusic, Heart, Clock, Calendar } from 'lucide-react';
import type { Track } from '../../stores/player.ts';
import { usePlaylist, usePlaylistTracks } from '../../lib/hooks.ts';
import React from 'react';
import { TrackRow } from '../../components/track/TrackRow.tsx';
import { dateFormatted, replaceArtSize, toCompactCount, toHourMinSec } from '../../lib/utils.ts';
import { useQueuePlayback } from '../../lib/hooks/useQueuePlayback.ts';

const PlaylistPageBase = () => {
  const { urn } = useParams<{ urn: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: playlist, isLoading: playlistLoading } = usePlaylist(urn);
  const { data: tracksData, isLoading: tracksLoading } = usePlaylistTracks(urn);
  const tracks: Track[] = tracksData?.collection ?? playlist?.tracks ?? [];

  const { shufflePlay, playAll, isQueuePlaying } = useQueuePlayback(tracks);

  const isLoading = playlistLoading || tracksLoading;

  if (isLoading || !playlist) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="text-white/15 animate-spin" />
      </div>
    );
  }

  const cover =
    replaceArtSize(playlist.artwork_url, 't500x500') ??
    replaceArtSize(tracks[0]?.artwork_url, 't500x500');

  return (
    <div className="p-6 pb-4 space-y-7 animate-fade-in-up">
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative rounded-3xl overflow-hidden glass-featured">
        {cover && (
          <div className="absolute inset-0 pointer-events-none">
            <img
              src={cover}
              alt=""
              className="w-full h-full object-cover scale-[1.5] blur-[100px] opacity-25 saturate-150"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[rgb(8,8,10)]/80 via-[rgb(8,8,10)]/60 to-[rgb(8,8,10)]/80" />
          </div>
        )}

        <div className="relative flex items-center gap-7 p-7">
          {/* Artwork */}
          <div
            className="relative w-[200px] h-[200px] rounded-2xl overflow-hidden shrink-0 shadow-2xl ring-1 ring-white/[0.1] cursor-pointer group/cover"
            onClick={playAll}
          >
            {cover ? (
              <img
                src={cover}
                alt={playlist.title}
                className="w-full h-full object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover/cover:scale-[1.04]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
                <ListMusic size={48} className="text-white/15" />
              </div>
            )}

            {/* Play overlay */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                isQueuePlaying
                  ? 'bg-black/30 opacity-100'
                  : 'bg-black/0 opacity-0 group-hover/cover:bg-black/30 group-hover/cover:opacity-100'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ease-[var(--ease-apple)] ${
                  isQueuePlaying
                    ? 'bg-white scale-100'
                    : 'bg-white/90 scale-75 group-hover/cover:scale-100'
                }`}
              >
                {isQueuePlaying ? (
                  <Pause size={22} fill="black" strokeWidth={0} />
                ) : (
                  <Play size={22} fill="black" strokeWidth={0} className="ml-0.5" />
                )}
              </div>
            </div>

            {/* Track count pill */}
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-[10px] font-medium bg-black/50 backdrop-blur-md text-white/70 px-2 py-1 rounded-full">
              <ListMusic size={10} />
              {tracks.length}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 py-2">
            <span className="inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.06] text-white/40 border border-white/[0.06] mb-3 uppercase tracking-wider">
              {playlist.playlist_type || 'Playlist'}
            </span>

            <h1 className="text-2xl font-bold text-white/95 leading-tight mb-2 line-clamp-2">
              {playlist.title}
            </h1>

            {/* Artist */}
            <div
              className="flex items-center gap-2.5 mb-5 cursor-pointer group/artist"
              onClick={() => navigate(`/user/${encodeURIComponent(playlist.user.urn)}`)}
            >
              {playlist.user.avatar_url && (
                <img
                  src={replaceArtSize(playlist.user.avatar_url, 'small') ?? ''}
                  alt=""
                  className="w-6 h-6 rounded-full ring-1 ring-white/[0.08] group-hover/artist:ring-white/[0.15] transition-all duration-150"
                />
              )}
              <span className="text-[14px] text-white/50 group-hover/artist:text-white/70 transition-colors">
                {playlist.user.username}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={playAll}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer shadow-[0_0_20px_var(--color-accent-glow)] ${
                  isQueuePlaying
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-accent text-white hover:bg-accent-hover active:scale-[0.97]'
                }`}
              >
                {isQueuePlaying ? (
                  <Pause size={16} fill="currentColor" strokeWidth={0} />
                ) : (
                  <Play size={16} fill="currentColor" strokeWidth={0} />
                )}
                {t('playlist.playAll')}
              </button>

              <button
                type="button"
                onClick={shufflePlay}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium glass hover:bg-white/[0.05] text-white/60 hover:text-white/80 transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer"
              >
                <Shuffle size={16} />
                {t('playlist.shuffle')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────── */}
      <section className="flex items-center gap-5 px-1 flex-wrap">
        <div className="flex items-center gap-1.5 text-[12px] text-white/30">
          <ListMusic size={13} className="text-white/20" />
          <span className="tabular-nums font-medium">{tracks.length}</span>
          <span className="text-white/15">{t('search.tracks').toLowerCase()}</span>
        </div>
        {playlist.likes_count != null && (
          <div className="flex items-center gap-1.5 text-[12px] text-white/30">
            <Heart size={13} className="text-white/20" />
            <span className="tabular-nums font-medium">{toCompactCount(playlist.likes_count)}</span>
            <span className="text-white/15">{t('track.likes')}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[12px] text-white/25 ml-auto">
          <Clock size={12} />
          <span className="tabular-nums">{toHourMinSec(playlist.duration)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-white/20">
          <Calendar size={12} />
          <span>{dateFormatted(playlist.created_at)}</span>
        </div>
      </section>

      {/* ── Description ──────────────────────────────── */}
      {playlist.description && (
        <section className="glass rounded-2xl p-5">
          <p className="text-[13px] text-white/45 leading-relaxed whitespace-pre-wrap break-words">
            {playlist.description}
          </p>
        </section>
      )}

      {/* ── Track list ───────────────────────────────── */}
      <section>
        {tracks.length === 0 ? (
          <div className="text-center py-12">
            <ListMusic size={32} className="text-white/10 mx-auto mb-3" />
            <p className="text-[13px] text-white/20">{t('playlist.noTracks')}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Header */}
            <div className="flex items-center gap-3.5 px-4 py-2 text-[10px] text-white/20 uppercase tracking-wider font-medium">
              <span className="w-8 text-center">#</span>
              <span className="w-10" />
              <span className="flex-1">Title</span>
              <span className="hidden sm:block w-[100px]" />
              <span className="w-10 text-right">
                <Clock size={10} className="inline" />
              </span>
            </div>
            <div className="h-px bg-white/[0.04] mx-4 mb-1" />

            {tracks.map((track, i) => (
              <TrackRow key={track.urn} track={track} index={i} queue={tracks} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
export const PlaylistPage = React.memo(PlaylistPageBase);
