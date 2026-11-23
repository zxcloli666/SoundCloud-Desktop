import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AudioLines,
  Compass,
  Disc3,
  Headphones,
  pauseWhite14,
  playWhite14,
} from '../../../lib/icons';
import { usePlayerStore } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import {
  ClusterEmptyState,
  type ClusterId,
  ClusterRow,
  ClusterSkeletonState,
  NeighborsRow,
  useClusterWave,
  waveQueue,
} from '../cluster';
import { useInfiniteWave } from './use-infinite-wave';

interface Props {
  trackUrn: string;
}

const CLUSTER_ORDER: ClusterId[] = [
  'wave',
  'same_artist',
  'same_vibe',
  'featured_with',
  'fans_also',
];

const CLUSTER_ICON: Partial<Record<ClusterId, React.ReactNode>> = {
  wave: <AudioLines size={14} />,
  same_artist: <Disc3 size={14} />,
  same_vibe: <AudioLines size={14} />,
  featured_with: <Compass size={14} />,
  fans_also: <Headphones size={14} />,
};

export const SoundWaveSimilarBlock = React.memo(function SoundWaveSimilarBlock({
  trackUrn,
}: Props) {
  const { t } = useTranslation();
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);

  const { data, isLoading } = useClusterWave({
    queryKey: ['cluster-wave', 'similar', trackUrn, hideListened],
    url: trackUrn
      ? `/recommendations/similar/${encodeURIComponent(trackUrn)}?hide_listened=${hideListened ? '1' : '0'}`
      : null,
  });

  const currentUrn = usePlayerStore((s) => s.currentTrack?.urn);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const queueHead = usePlayerStore((s) => s.queue[0]?.urn);

  const clusters = useMemo(() => data?.clusters ?? [], [data]);

  const orderedClusters = useMemo(() => {
    const byId = new Map(clusters.map((c) => [c.id, c]));
    return CLUSTER_ORDER.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  }, [clusters]);

  const waveCluster = useMemo(
    () => orderedClusters.find((c) => c.id === 'wave') ?? null,
    [orderedClusters],
  );
  const playQueue = useMemo(() => waveQueue(orderedClusters), [orderedClusters]);
  const onWave = !!currentUrn && queueHead === playQueue[0]?.urn;
  const isPlayingFromWave = isPlaying && onWave;

  useInfiniteWave({
    enabled: !!trackUrn,
    seedKind: 'track',
    seedId: trackUrn,
    initialTracks: waveCluster?.tracks ?? [],
    initialCursor: waveCluster?.cursor ?? null,
    hideListened,
  });

  const handlePlay = useCallback(() => {
    if (playQueue.length === 0) return;
    const { play, pause, resume } = usePlayerStore.getState();
    if (isPlayingFromWave) {
      pause();
      return;
    }
    if (onWave) {
      resume();
      return;
    }
    play(playQueue[0], playQueue);
  }, [playQueue, isPlayingFromWave, onWave]);

  const showEmpty = !isLoading && orderedClusters.length === 0;
  const canPlay = playQueue.length > 0;

  return (
    <section className="panel select-none overflow-hidden">
      <div className="flex items-center gap-3 p-3 md:gap-4 md:p-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink/[0.06] text-accent">
          <AudioLines size={18} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[14px] font-semibold leading-none tracking-tight text-ink">
              {t('soundwave.similar.title')}
            </h2>
            <span className="shrink-0 rounded-full bg-ink/[0.07] px-1.5 py-[2px] text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-70">
              AI
            </span>
          </div>
          <p className="truncate text-[11px] text-ink-45">{t('soundwave.similar.desc')}</p>
        </div>

        <button
          type="button"
          onClick={handlePlay}
          disabled={!canPlay || isLoading}
          className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-accent pl-1.5 pr-4 text-[12.5px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-shade-15">
            {isPlayingFromWave ? pauseWhite14 : playWhite14}
          </span>
          <span className="whitespace-nowrap">
            {isPlayingFromWave ? t('track.pause') : t('soundwave.similar.playAll')}
          </span>
        </button>
      </div>

      <div className="border-t border-ink/[0.08] p-5 md:p-6">
        {isLoading ? (
          <ClusterSkeletonState rows={2} itemsPerRow={6} />
        ) : showEmpty ? (
          <ClusterEmptyState
            title={t('soundwave.similar.empty')}
            description={t('soundwave.similar.emptyDesc')}
          />
        ) : (
          <div className="flex flex-col gap-7">
            {orderedClusters.map((c, idx) =>
              c.id === 'featured_with' && c.neighbors ? (
                <NeighborsRow
                  key={c.id}
                  title={t(`soundwave.similar.cluster.${c.id}`)}
                  description={t(`soundwave.similar.cluster.${c.id}Desc`)}
                  icon={CLUSTER_ICON[c.id]}
                  index={idx}
                  cluster={c}
                />
              ) : (
                <ClusterRow
                  key={c.id}
                  clusterId={c.id}
                  title={t(`soundwave.similar.cluster.${c.id}`)}
                  description={t(`soundwave.similar.cluster.${c.id}Desc`)}
                  icon={CLUSTER_ICON[c.id]}
                  index={idx}
                  tracks={c.tracks}
                  queue={c.tracks}
                />
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
});
