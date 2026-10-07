import { art } from '../../../lib/formatters';
import { Music } from '../../../lib/icons';
import { useTrackDisplay } from '../../../lib/track-display';
import type { Track } from '../../../stores/player';

export function TrackMenuHeader({ track }: { track: Track }) {
  const display = useTrackDisplay(track);
  const cover = art(track.artwork_url, 't200x200');

  return (
    <div className="flex items-center gap-3 px-2.5 pt-1.5 pb-2.5">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08] shadow-md">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" decoding="async" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music size={14} className="text-white/25" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-snug text-white/90">
          {display.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-white/40">
          {display.artistLine || track.user?.username}
        </p>
      </div>
    </div>
  );
}
