import { memo } from 'react';
import { preloadTrack } from '../../lib/audio';
import { type Aura, auraRgb, auraRgba, isLight } from '../../lib/aura';
import { art, dur } from '../../lib/formatters';
import {
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

interface AlbumTrackRowProps {
  track: Track;
  position: number;
  queue: Track[];
  aura: Aura;
}

function AlbumTrackRowImpl({ track, position, queue, aura }: AlbumTrackRowProps) {
  const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  const cover = art(track.artwork_url, 't200x200');
  const lightAura = isLight(aura);
  const playIcon = lightAura ? playBlack14 : playWhite14;
  const pauseIcon = lightAura ? pauseBlack14 : pauseWhite14;
  const hoverB = usePerfMode().blur(16);

  return (
    <div
      className="group flex items-center gap-4 px-4 py-2.5 rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] select-none"
      style={{
        background: isThis
          ? `linear-gradient(90deg, ${auraRgba(aura, 0.16)}, ${auraRgba(aura, 0.04)} 70%, transparent)`
          : undefined,
        boxShadow: isThis ? `inset 0 0 0 1px ${auraRgba(aura, 0.35)}` : undefined,
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
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: auraRgb(aura),
              boxShadow: `0 0 24px ${auraRgba(aura, 0.5)}`,
            }}
          >
            {pauseIcon}
          </div>
        ) : (
          <>
            <span className="text-[13px] text-white/30 tabular-nums font-semibold group-hover:opacity-0 transition-opacity">
              {position}
            </span>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  background: lightAura
                    ? auraRgba(aura, 0.85)
                    : hoverB > 0
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(54,54,60,0.92)',
                  boxShadow: `inset 0 0 0 1px ${auraRgba(aura, 0.3)}`,
                  backdropFilter: hoverB > 0 ? `blur(${hoverB}px)` : undefined,
                  WebkitBackdropFilter: hoverB > 0 ? `blur(${hoverB}px)` : undefined,
                }}
              >
                {playIcon}
              </div>
            </div>
          </>
        )}
      </div>

      <div
        className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 transition-transform duration-500 group-hover:scale-105"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
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
            <Music size={14} className="text-white/20" />
          </div>
        )}
      </div>

      <TrackTitleArtist track={track} highlight={isThis} size="md" className="flex-1 min-w-0" />

      <div className="shrink-0">
        <TrackStatusBadges meta={track._scd_meta} />
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

const areEqual = (prev: AlbumTrackRowProps, next: AlbumTrackRowProps) =>
  prev.track.urn === next.track.urn &&
  prev.position === next.position &&
  prev.aura.id === next.aura.id &&
  prev.aura.accent[0] === next.aura.accent[0] &&
  prev.aura.accent[1] === next.aura.accent[1] &&
  prev.aura.accent[2] === next.aura.accent[2] &&
  prev.track.user_favorite === next.track.user_favorite &&
  sameScdMeta(prev.track._scd_meta, next.track._scd_meta);

export const AlbumTrackRow = memo(AlbumTrackRowImpl, areEqual);
