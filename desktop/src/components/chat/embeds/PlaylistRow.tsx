import { memo } from 'react';
import { durLong } from '../../../lib/formatters';
import { AudioLines } from '../../../lib/icons';
import type { Track } from '../../../stores/player';
import { togglePlay, useIsCurrent, useIsPlaying } from './embed-track';

interface PlaylistRowProps {
  track: Track;
  index: number;
  onPlay: () => void;
}

export const PlaylistRow = memo(function PlaylistRow({ track, index, onPlay }: PlaylistRowProps) {
  const current = useIsCurrent(track.urn);
  const playing = useIsPlaying(track.urn);
  return (
    <li>
      <button
        type="button"
        onClick={() => (current ? togglePlay(track) : onPlay())}
        className={`group/row flex h-8 w-full min-w-0 items-center gap-2.5 rounded-[9px] px-1.5 text-left transition-colors duration-200 cursor-pointer hover:bg-ink/[0.05] ${
          current ? 'bg-ink/[0.05]' : ''
        }`}
      >
        <span className="flex w-4 shrink-0 justify-center text-[10.5px] tabular-nums text-ink-30">
          {playing ? <AudioLines size={12} className="text-accent" /> : index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px]">
          <span className={current ? 'text-accent' : 'text-ink-80'}>{track.title}</span>
          {track.user.username && <span className="text-ink-35"> · {track.user.username}</span>}
        </span>
        {track.duration > 0 && (
          <span className="shrink-0 text-[10.5px] tabular-nums text-ink-30">
            {durLong(track.duration)}
          </span>
        )}
      </button>
    </li>
  );
});
