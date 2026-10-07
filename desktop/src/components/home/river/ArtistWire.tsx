import React, {useMemo} from 'react';
import {art, dur} from '../../../lib/formatters';
import {playWhite14} from '../../../lib/icons';
import {ClusterFeedbackProvider} from '../../../lib/recsFeedback';
import type {Track} from '../../../stores/player';
import {usePlayerStore} from '../../../stores/player';
import type {ClusterHydrated, ClusterNeighborDto} from '../../music/cluster';
import {HorizontalScroll} from '../../ui/HorizontalScroll';

/** «Твои артисты» — отмель: круги на линии воды. Клик играет очередь из лучших
 *  треков артиста (resolveQueue — тот же контракт, что у NeighborCard). */
export const ArtistWire = React.memo(function ArtistWire({
  cluster,
  resolveQueue,
}: {
  cluster: ClusterHydrated;
  resolveQueue: (track: Track) => Promise<Track[]>;
}) {
  const ctx = useMemo(() => ({ clusterId: String(cluster.id) }), [cluster.id]);

  const pairs = useMemo(() => {
    const byUrn = new Map(cluster.tracks.map((t) => [t.urn, t]));
    const out: Array<{ neighbor: ClusterNeighborDto; track: Track }> = [];
    for (const n of cluster.neighbors ?? []) {
      const track = byUrn.get(n.track_urn);
      if (track) out.push({ neighbor: n, track });
    }
    return out;
  }, [cluster]);

  if (pairs.length === 0) return null;

  const play = async (track: Track) => {
    const queue = await resolveQueue(track);
    usePlayerStore.getState().play(queue[0] ?? track, queue);
  };

  return (
    <ClusterFeedbackProvider value={ctx}>
      <div className="relative pb-1 pt-2">
        <span
          className="pointer-events-none absolute left-0 right-0 top-[58px] h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.2) 8%, rgba(255,255,255,0.2) 92%, transparent)',
          }}
        />
        <HorizontalScroll className="relative !gap-7 px-1">
          {pairs.map(({ neighbor, track }) => (
            <button
              key={neighbor.artist_id}
              type="button"
              onClick={() => void play(track)}
              className="group flex w-[128px] flex-none cursor-pointer flex-col items-center gap-2.5 transition-transform hover:-translate-y-1"
              title={`${neighbor.artist_name} — ${track.title}`}
            >
              <span className="relative block size-[92px] overflow-hidden rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_12px_28px_rgba(0,0,0,0.45)] transition-shadow group-hover:shadow-[0_0_0_2px_var(--color-accent),0_0_24px_var(--color-accent-glow),0_12px_28px_rgba(0,0,0,0.45)]">
                {neighbor.avatar_url ? (
                  <img
                    src={art(neighbor.avatar_url, 't300x300') ?? undefined}
                    alt=""
                    className="size-full object-cover"
                    decoding="async"
                    loading="lazy"
                  />
                ) : (
                  <span className="block size-full bg-white/[0.06]" />
                )}
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {playWhite14}
                </span>
              </span>
              <span className="max-w-full truncate text-[13px] font-semibold text-white/85">
                {neighbor.artist_name}
              </span>
              {/* что заиграет: трек-сид этого артиста */}
              <span className="flex w-full items-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-1.5 text-left transition-colors group-hover:border-[var(--color-accent-glow)] group-hover:bg-white/[0.05]">
                <span className="block size-7 flex-none overflow-hidden rounded-md ring-1 ring-white/[0.08]">
                  {art(track.artwork_url, 't200x200') ? (
                    <img
                      src={art(track.artwork_url, 't200x200') ?? undefined}
                      alt=""
                      className="size-full object-cover"
                      decoding="async"
                      loading="lazy"
                    />
                  ) : (
                    <span className="block size-full bg-white/[0.06]" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] font-medium leading-tight text-white/60 transition-colors group-hover:text-white/85">
                    {track.title}
                  </span>
                  <span className="block font-mono text-[9.5px] leading-tight text-white/30 tabular-nums">
                    {dur(track.duration)}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </HorizontalScroll>
      </div>
    </ClusterFeedbackProvider>
  );
});
