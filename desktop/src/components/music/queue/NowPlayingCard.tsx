import React from 'react';
import {useShallow} from 'zustand/shallow';
import {art, dur} from '../../../lib/formatters';
import {useArtistDisplay, useArtistLinkItems, useDisplayTitle} from '../../../lib/track-display';
import {type Track, usePlayerStore} from '../../../stores/player';
import {ArtistNameLinks} from '../ArtistNameLinks';
import {TrackStatusBadges} from '../TrackStatusBadges';
import {UploadKindDot} from '../UploadKindDot';
import {PlayingOverlay} from './PlayingOverlay';

const NowPlayingBody = React.memo(({ track }: { track: Track }) => {
  const artistDisplay = useArtistDisplay(track);
  const displayTitle = useDisplayTitle(track);
  const artistLinks = useArtistLinkItems(track);
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[12.5px] text-accent font-semibold truncate leading-snug">
        {displayTitle}
      </p>
      <p className="text-[10.5px] text-white/40 truncate mt-0.5 flex items-center gap-1">
        <UploadKindDot kind={artistDisplay.uploadKind} />
        <span className="truncate">
          <ArtistNameLinks
            items={artistLinks}
            linkClassName="cursor-pointer transition-colors hover:text-white/70"
          />
        </span>
      </p>
    </div>
  );
});

export const NowPlayingCard = React.memo(() => {
  const { currentTrack, isPlaying } = usePlayerStore(
    useShallow((s) => ({ currentTrack: s.currentTrack, isPlaying: s.isPlaying })),
  );

  if (!currentTrack) return null;
  const artwork = art(currentTrack.artwork_url || currentTrack.user?.avatar_url, 't200x200');

  const handleClick = () => {
    const { pause, resume } = usePlayerStore.getState();
    isPlaying ? pause() : resume();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl overflow-hidden text-left cursor-pointer ring-1 ring-[var(--color-accent)]/25 transition-all duration-200 hover:ring-[var(--color-accent)]/40"
      style={{ background: 'var(--color-accent-glow)' }}
    >
      {/* accent wash for depth */}
      <span
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background: 'linear-gradient(105deg, var(--color-accent-glow) 0%, transparent 55%)',
        }}
      />
      <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-white/[0.04] ring-1 ring-white/[0.1]">
        {artwork ? (
          <img src={artwork} alt="" className="w-full h-full object-cover" decoding="async" />
        ) : (
          <div className="w-full h-full" />
        )}
        <PlayingOverlay isPlaying={isPlaying} />
      </div>
      <NowPlayingBody track={currentTrack} />
      <div className="relative shrink-0">
        <TrackStatusBadges meta={currentTrack._scd_meta} />
      </div>
      <span className="relative text-[10px] text-white/35 tabular-nums shrink-0">
        {dur(currentTrack.duration)}
      </span>
    </button>
  );
});
