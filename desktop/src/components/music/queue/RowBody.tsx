import React from 'react';
import { art } from '../../../lib/formatters';
import { pauseWhite12, playWhite12 } from '../../../lib/icons';
import { useArtistDisplay, useArtistLinkItems, useDisplayTitle } from '../../../lib/track-display';
import type { Track } from '../../../stores/player';
import { ArtistNameLinks } from '../ArtistNameLinks';
import { UploadKindDot } from '../UploadKindDot';
import { PlayingBars } from './PlayingBars';

interface Props {
  track: Track;
  now: boolean;
  playing: boolean;
  hover?: boolean;
}

export const RowCover = React.memo(function RowCover({ track, now, playing, hover = true }: Props) {
  const cover = art(track.artwork_url || track.user?.avatar_url, 't200x200');
  return (
    <span className="relative size-11 shrink-0 overflow-hidden rounded-[10px] bg-ink/[0.06]">
      {cover && (
        <img
          data-ui="artwork"
          src={cover}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      )}
      {now && (
        <span
          data-scheme="dark"
          className={`absolute inset-0 flex items-center justify-center bg-shade-45 transition-opacity ${hover ? 'group-hover:opacity-0' : ''}`}
        >
          <PlayingBars live={playing} />
        </span>
      )}
      {hover && (
        <span
          data-scheme="dark"
          className="absolute inset-0 flex items-center justify-center bg-shade-50 text-ink opacity-0 transition-opacity group-hover:opacity-100"
        >
          {now && playing ? pauseWhite12 : playWhite12}
        </span>
      )}
    </span>
  );
});

export const RowText = React.memo(function RowText({ track, now }: { track: Track; now: boolean }) {
  const title = useDisplayTitle(track);
  const artist = useArtistDisplay(track);
  const links = useArtistLinkItems(track);
  return (
    <span className="min-w-0 flex-1">
      <span
        className={`block truncate text-[13.5px] font-semibold leading-tight ${now ? 'text-accent' : 'text-ink-90'}`}
      >
        {title}
      </span>
      <span className="mt-1 flex min-w-0 items-center gap-1 text-[12px] leading-tight text-ink-50">
        <UploadKindDot kind={artist.uploadKind} />
        <span className="truncate">
          <ArtistNameLinks items={links} linkClassName="cursor-pointer transition-colors" />
        </span>
      </span>
    </span>
  );
});
