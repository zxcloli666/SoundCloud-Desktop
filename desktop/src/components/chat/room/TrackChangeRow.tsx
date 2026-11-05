import { memo } from 'react';
import type { Embed } from '../../../lib/chat/types';
import { art } from '../../../lib/formatters';
import { Disc3 } from '../../../lib/icons';

export const TrackChangeRow = memo(function TrackChangeRow({ track }: { track: Embed }) {
  const cover = art(track.artworkUrl, 't200x200');
  return (
    <div className="flex justify-center px-6 pt-3 pb-1">
      <span className="flex max-w-full items-center gap-2 rounded-full bg-ink/[0.04] py-1 pr-3 pl-1 text-[11.5px] text-ink-55">
        <span className="relative size-5 shrink-0 overflow-hidden rounded-full bg-ink/[0.08]">
          {cover ? (
            <img src={cover} alt="" className="size-full object-cover" />
          ) : (
            <Disc3 size={12} className="absolute inset-1 text-ink-40" />
          )}
        </span>
        <span className="min-w-0 truncate">
          <span className="font-semibold text-ink-80">{track.title}</span>
          {track.artist && <span className="text-ink-40"> {track.artist}</span>}
        </span>
      </span>
    </div>
  );
});
