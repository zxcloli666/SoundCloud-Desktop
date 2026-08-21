import { Lock } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { preloadTrack } from '../../lib/audio';
import { type Aura, auraRgb, auraRgba, isLight } from '../../lib/aura';
import { art, dur, fc } from '../../lib/formatters';
import {
  headphones11,
  heart11,
  ListPlus,
  Music,
  pauseBlack14,
  pauseWhite14,
  playBlack14,
  playWhite14,
} from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { useTrackPlay } from '../../lib/useTrackPlay';
import type { Track } from '../../stores/player';
import { AddToPlaylistDialog } from '../music/AddToPlaylistDialog';
import { LikeButton } from '../music/LikeButton';
import { sameScdMeta, TrackStatusBadges } from '../music/TrackStatusBadges';
import { TrackTitleArtist } from '../music/TrackTitleArtist';

interface ThemedTrackRowProps {
  track: Track;
  index: number;
  queue: Track[];
  aura: Aura;
}

function ThemedTrackRowImpl({ track, index, queue, aura }: ThemedTrackRowProps) {
  const { t } = useTranslation();
  const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  const cover = art(track.artwork_url, 't200x200');
  const lightAura = isLight(aura);
  const playIcon = lightAura ? playBlack14 : playWhite14;
  const pauseIcon = lightAura ? pauseBlack14 : pauseWhite14;
  const pb = usePerfMode().blur(16);

  return (
    <div
      className="group flex items-center gap-4 px-4 py-2.5 rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] select-none"
      style={{
        background: isThis
          ? `linear-gradient(90deg, ${auraRgba(aura, 0.16)}, ${auraRgba(aura, 0.04)} 70%, transparent)`
          : undefined,
        boxShadow: isThis ? `inset 0 0 0 0.5px ${auraRgba(aura, 0.35)}` : undefined,
      }}
      onMouseEnter={(e) => {
        preloadTrack(track.urn);
        if (!isThis) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!isThis) e.currentTarget.style.background = '';
      }}
    >
      <div
        className="w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer relative"
        onClick={togglePlay}
      >
        {isThisPlaying ? (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center transition-transform duration-300"
            style={{
              background: auraRgb(aura),
              boxShadow: `0 0 24px ${auraRgba(aura, 0.5)}`,
            }}
          >
            {pauseIcon}
          </div>
        ) : (
          <>
            <span className="text-[12px] text-white/25 tabular-nums font-semibold group-hover:opacity-0 transition-opacity">
              {index + 1}
            </span>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  background:
                    pb > 0
                      ? lightAura
                        ? auraRgba(aura, 0.8)
                        : 'rgba(255,255,255,0.1)'
                      : lightAura
                        ? auraRgb(aura)
                        : 'rgba(48,48,54,0.92)',
                  border: `0.5px solid ${auraRgba(aura, 0.3)}`,
                  backdropFilter: pb > 0 ? `blur(${pb}px)` : undefined,
                  WebkitBackdropFilter: pb > 0 ? `blur(${pb}px)` : undefined,
                }}
              >
                {playIcon}
              </div>
            </div>
          </>
        )}
      </div>

      <div
        className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 transition-transform duration-500 group-hover:scale-105"
        style={{ border: '0.5px solid rgba(255,255,255,0.08)' }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.04]">
            <Music size={16} className="text-white/20" />
          </div>
        )}
        {track.sharing === 'private' && (
          <div
            title={t('sharing.private')}
            aria-label={t('sharing.private')}
            className="absolute top-0.5 left-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-black/65 backdrop-blur-md text-amber-300/90"
          >
            <Lock size={9} />
          </div>
        )}
      </div>

      <TrackTitleArtist track={track} highlight={isThis} size="md" className="flex-1 min-w-0" />

      <div className="hidden md:flex shrink-0">
        <TrackStatusBadges meta={track._scd_meta} />
      </div>

      <div className="hidden md:flex items-center gap-5 shrink-0 pr-2 text-[11px] text-white/35">
        {track.playback_count != null && (
          <span className="inline-flex items-center gap-1.5 tabular-nums w-16">
            {headphones11} {fc(track.playback_count)}
          </span>
        )}
        {(track.favoritings_count ?? track.likes_count) != null && (
          <span className="inline-flex items-center gap-1.5 tabular-nums w-14">
            {heart11} {fc(track.favoritings_count ?? track.likes_count)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <LikeButton track={track} />
        <AddToPlaylistDialog trackUrns={[track.urn]}>
          <button
            type="button"
            className="cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/80 hover:bg-white/[0.06] opacity-0 group-hover:opacity-100 transition-all"
          >
            <ListPlus size={14} />
          </button>
        </AddToPlaylistDialog>
      </div>

      <span className="text-[12px] text-white/30 tabular-nums font-medium shrink-0 w-12 text-right">
        {dur(track.duration)}
      </span>
    </div>
  );
}

const areEqual = (prev: ThemedTrackRowProps, next: ThemedTrackRowProps) =>
  prev.track.urn === next.track.urn &&
  prev.index === next.index &&
  prev.aura.id === next.aura.id &&
  prev.aura.accent[0] === next.aura.accent[0] &&
  prev.aura.accent[1] === next.aura.accent[1] &&
  prev.aura.accent[2] === next.aura.accent[2] &&
  prev.track.user_favorite === next.track.user_favorite &&
  prev.track.sharing === next.track.sharing &&
  sameScdMeta(prev.track._scd_meta, next.track._scd_meta);

export const ThemedTrackRow = React.memo(ThemedTrackRowImpl, areEqual);
