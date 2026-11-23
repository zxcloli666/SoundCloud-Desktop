import { art, dur } from '../../../lib/formatters';
import { pauseWhite12, playWhite12 } from '../../../lib/icons';
import {
  recordClusterFeedback,
  setUrnCluster,
  useClusterFeedback,
} from '../../../lib/recsFeedback';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import type { ClusterNeighborDto } from '../../music/cluster';

interface Props {
  track: Track;
  onPlay: () => void;
  artist?: ClusterNeighborDto;
  framed?: boolean;
}

export function TrackRow({ track, onPlay, artist, framed = false }: Props) {
  const current = usePlayerStore((s) => s.currentTrack?.urn === track.urn);
  const playing = usePlayerStore((s) => s.isPlaying && s.currentTrack?.urn === track.urn);
  const clusterId = useClusterFeedback();
  const cover = art(artist?.avatar_url || track.artwork_url || track.user?.avatar_url, 't200x200');
  const pick = () => {
    if (current) return usePlayerStore.getState().togglePlay();
    if (clusterId) {
      setUrnCluster(track.urn, clusterId);
      recordClusterFeedback(clusterId, 'click');
    }
    onPlay();
  };
  return (
    <button
      type="button"
      aria-current={current || undefined}
      onClick={pick}
      className={`group flex h-[66px] w-full cursor-pointer items-center gap-3 rounded-[13px] border px-2.5 text-left outline-none transition-colors focus-visible:border-accent/60 ${
        current
          ? 'border-ink/[0.2] bg-ink/[0.09]'
          : `${framed ? 'border-ink/[0.1]' : 'border-transparent'} bg-ink/[0.03] hover:border-ink/[0.14] hover:bg-ink/[0.06]`
      }`}
    >
      <span
        className={`relative size-[46px] shrink-0 overflow-hidden bg-ink/[0.06] ${
          artist ? 'rounded-full' : 'rounded-[9px]'
        }`}
      >
        {cover && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        )}
        <span
          data-scheme="dark"
          className="absolute inset-0 flex items-center justify-center bg-black/50 text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {playing ? pauseWhite12 : playWhite12}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold leading-tight text-ink-90">
          {artist?.artist_name ?? track.title}
        </span>
        <span className="mt-1 block truncate text-[12.5px] leading-tight text-ink-50">
          {artist ? track.title : track.user?.username}
        </span>
      </span>
      <span className="shrink-0 pr-0.5 font-mono text-[11.5px] tabular-nums text-ink-35">
        {dur(track.duration)}
      </span>
    </button>
  );
}
