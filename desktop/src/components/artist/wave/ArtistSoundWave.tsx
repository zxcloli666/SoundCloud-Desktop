import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AudioLines,
  ChevronDown,
  Compass,
  Disc3,
  pauseWhite14,
  playWhite14,
  Star,
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
} from '../../music/cluster';
import { useInfiniteWave } from '../../music/soundwave/use-infinite-wave';

interface Props {
  artistId: string;
  artistName: string;
}

const CLUSTER_ORDER: ClusterId[] = ['wave', 'essence', 'vibe', 'neighbors', 'deep'];

const CLUSTER_ICON: Partial<Record<ClusterId, React.ReactNode>> = {
  wave: <AudioLines size={14} />,
  essence: <Disc3 size={14} />,
  vibe: <AudioLines size={14} />,
  neighbors: <Compass size={14} />,
  deep: <Star size={14} />,
};

export const ArtistSoundWave = React.memo(function ArtistSoundWave({
  artistId,
  artistName,
}: Props) {
  const { t } = useTranslation();
  const collapsed = useSettingsStore((s) => s.artistWaveCollapsed);
  const setCollapsed = useSettingsStore((s) => s.setArtistWaveCollapsed);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);

  const { data, isLoading } = useClusterWave({
    queryKey: ['cluster-wave', 'artist', artistId, hideListened],
    url: artistId
      ? `/recommendations/artist/${encodeURIComponent(artistId)}?hide_listened=${hideListened ? '1' : '0'}`
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
    enabled: !!artistId,
    seedKind: 'artist',
    seedId: artistId,
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
  const playIcon = isPlayingFromWave ? pauseWhite14 : playWhite14;

  return (
    <section className="panel select-none overflow-hidden">
      <div className="flex items-center gap-3 p-3 md:gap-4 md:p-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink/[0.06] text-accent">
          <AudioLines size={18} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-semibold leading-none tracking-tight text-ink">
              {t('artist.wave.title')}
            </span>
            <span className="shrink-0 rounded-full bg-ink/[0.07] px-1.5 py-[2px] text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-70">
              AI
            </span>
          </div>
          <p className="truncate text-[11px] text-ink-45" title={artistName}>
            {t('artist.wave.desc', { name: artistName })}
          </p>
        </div>

        <button
          type="button"
          onClick={handlePlay}
          disabled={!canPlay || isLoading}
          className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-accent pl-1.5 pr-4 text-[12.5px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-shade-15">
            {playIcon}
          </span>
          <span className="whitespace-nowrap">
            {isPlayingFromWave ? t('artist.wave.pause') : t('artist.wave.playAll')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
          title={collapsed ? t('nav.expand') : t('nav.collapse')}
          className="shell-btn shrink-0 rounded-full"
        >
          <ChevronDown
            size={14}
            className="transition-transform duration-300"
            style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="border-t border-ink/[0.08] p-5 md:p-6">
          {isLoading ? (
            <ClusterSkeletonState />
          ) : showEmpty ? (
            <ClusterEmptyState
              title={t('artist.wave.empty')}
              description={t('artist.wave.emptyDesc')}
            />
          ) : (
            <div className="flex flex-col gap-7">
              {orderedClusters.map((c, idx) =>
                c.id === 'neighbors' && c.neighbors ? (
                  <NeighborsRow
                    key={c.id}
                    title={t(`artist.wave.cluster.${c.id}`)}
                    description={t(`artist.wave.cluster.${c.id}Desc`)}
                    icon={CLUSTER_ICON[c.id]}
                    index={idx}
                    cluster={c}
                  />
                ) : (
                  <ClusterRow
                    key={c.id}
                    clusterId={c.id}
                    title={t(`artist.wave.cluster.${c.id}`)}
                    description={t(`artist.wave.cluster.${c.id}Desc`)}
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
      )}
    </section>
  );
});
