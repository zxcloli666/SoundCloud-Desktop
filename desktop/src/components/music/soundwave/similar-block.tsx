import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isUrnDisliked, useDislikeVersion } from '../../../lib/dislikes';
import { isRecommendationTrackPlayable } from '../../../lib/home-recommendations';
import { curateWithLocalTaste } from '../../../lib/local-recommendations';
import { AudioLines, Compass, Disc3, Headphones, playBlack14, Sparkles } from '../../../lib/icons';
import { usePlayerStore } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import {
  ClusterEmptyState,
  type ClusterId,
  ClusterRow,
  ClusterSkeletonState,
  NeighborsRow,
  useClusterWave,
} from '../cluster';
import { AmbientLayer } from './ambient';
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
  const trackId = useMemo(() => trackUrn.split(':').pop() ?? '', [trackUrn]);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const recommendationMode = useSettingsStore((s) => s.soundwaveMode);
  const dislikeVersion = useDislikeVersion();

  const { data, isLoading } = useClusterWave({
    queryKey: ['cluster-wave', 'similar', trackId, hideListened],
    url: trackId
      ? `/recommendations/similar/${encodeURIComponent(trackId)}?hide_listened=${hideListened ? '1' : '0'}`
      : null,
  });

  const clusters = useMemo(
    () => {
      void dislikeVersion;
      return (data?.clusters ?? [])
        .map((cluster) => ({
          ...cluster,
          tracks: cluster.tracks.filter(
            (track) => !isUrnDisliked(track.urn) && isRecommendationTrackPlayable(track),
          ),
        }))
        .filter((cluster) => cluster.tracks.length > 0);
    },
    [data, dislikeVersion],
  );
  const allTracks = useMemo(
    () => {
      void dislikeVersion;
      const inputs = data?.candidates?.length ? data.candidates : (data?.allTracks ?? []);
      return curateWithLocalTaste(inputs, {
        hideListened,
        mode: recommendationMode,
        limit: inputs.length,
      });
    },
    [data, dislikeVersion, hideListened, recommendationMode],
  );

  const orderedClusters = useMemo(() => {
    const byId = new Map(clusters.map((c) => [c.id, c]));
    return CLUSTER_ORDER.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  }, [clusters]);

  const waveCluster = useMemo(
    () => orderedClusters.find((c) => c.id === 'wave') ?? null,
    [orderedClusters],
  );

  useInfiniteWave({
    enabled: !!trackId,
    seedKind: 'track',
    seedId: trackId,
    initialTracks: waveCluster?.tracks ?? [],
    initialCursor: null,
    hideListened,
  });

  const handlePlay = useCallback(() => {
    if (allTracks.length === 0) return;
    usePlayerStore.getState().play(allTracks[0], allTracks);
  }, [allTracks]);

  const showEmpty = !isLoading && orderedClusters.length === 0;
  const canPlay = allTracks.length > 0;

  return (
    <section
      className="relative rounded-3xl overflow-hidden glass-featured select-none"
      style={{
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.04) inset, 0 10px 40px rgba(0,0,0,0.35), 0 0 40px var(--color-accent-glow)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <AmbientLayer particleCount={8} blur={35} intensity={0.4} />

      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            'linear-gradient(180deg, rgba(8,8,10,0.45) 0%, rgba(8,8,10,0.35) 45%, rgba(8,8,10,0.85) 100%)',
          contain: 'strict',
        }}
      />

      <div className="relative p-5 md:p-6 flex flex-col gap-6" style={{ isolation: 'isolate' }}>
        <header className="flex items-center gap-3 flex-wrap">
          <div
            className="relative w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent), rgba(255,255,255,0.12))',
              boxShadow: '0 0 24px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <AudioLines size={17} style={{ color: 'var(--color-accent-contrast)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="soundwave-title text-[18px] font-black tracking-tight leading-none">
                {t('soundwave.similar.title')}
              </h2>
              <span
                className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] px-2 py-[3px] rounded-full text-white/90"
                style={{
                  background:
                    'linear-gradient(135deg, var(--color-accent-glow), rgba(255,255,255,0.06))',
                  border: '0.5px solid var(--color-accent-glow)',
                }}
              >
                <Sparkles size={9} style={{ color: 'var(--color-accent)' }} />
                AI
              </span>
            </div>
            <p className="text-[11.5px] text-white/45 mt-1 truncate">
              {t('soundwave.similar.desc')}
            </p>
          </div>

          {canPlay && (
            <button
              type="button"
              onClick={handlePlay}
              className="flex items-center gap-2 pl-2.5 pr-4 h-9 rounded-full font-semibold text-[12.5px] transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer active:scale-[0.97] hover:scale-[1.03]"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-accent-contrast)',
                boxShadow:
                  '0 5px 18px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.9)' }}
              >
                {playBlack14}
              </span>
              {t('soundwave.similar.playAll')}
            </button>
          )}
        </header>

        {isLoading ? (
          <ClusterSkeletonState rows={2} itemsPerRow={6} />
        ) : showEmpty ? (
          <ClusterEmptyState
            title={t('soundwave.similar.empty')}
            description={t('soundwave.similar.emptyDesc')}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {orderedClusters.map((c, idx) =>
              c.id === 'featured_with' && c.neighbors ? (
                <NeighborsRow
                  key={c.id}
                  title={t(`soundwave.similar.cluster.${c.id}`)}
                  description={t(`soundwave.similar.cluster.${c.id}Desc`)}
                  icon={CLUSTER_ICON[c.id]}
                  index={idx}
                  cluster={c}
                  queue={c.tracks}
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
