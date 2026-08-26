import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Aura, auraRgb, auraRgba, isLight } from '../../../lib/aura';
import { isUrnDisliked, useDislikeVersion } from '../../../lib/dislikes';
import { isRecommendationTrackPlayable } from '../../../lib/home-recommendations';
import { curateWithLocalTaste } from '../../../lib/local-recommendations';
import {
  AudioLines,
  ChevronDown,
  Compass,
  Disc3,
  pauseBlack14,
  pauseWhite14,
  playBlack14,
  playWhite14,
  Sparkles,
  Star,
} from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { usePlayerStore } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import {
  ClusterEmptyState,
  type ClusterId,
  ClusterRow,
  ClusterSkeletonState,
  NeighborsRow,
  useClusterWave,
} from '../../music/cluster';
import { AmbientLayer } from '../../music/soundwave/ambient';
import { useInfiniteWave } from '../../music/soundwave/use-infinite-wave';

interface Props {
  artistId: string;
  artistName: string;
  aura: Aura;
}

const CLUSTER_ORDER: ClusterId[] = ['wave', 'essence', 'vibe', 'neighbors', 'deep'];

const CLUSTER_ICON: Partial<Record<ClusterId, React.ReactNode>> = {
  wave: <AudioLines size={14} />,
  essence: <Disc3 size={14} />,
  vibe: <AudioLines size={14} />,
  neighbors: <Compass size={14} />,
  deep: <Star size={14} />,
};

const WAVE_KEYFRAMES = `
@keyframes artistWaveEq {
  0%,100% { transform: scaleY(0.35); }
  50%     { transform: scaleY(1); }
}
@keyframes artistWaveSheen {
  0%   { transform: translateX(-110%); }
  60%  { transform: translateX(110%); }
  100% { transform: translateX(110%); }
}
.artist-wave-sheen { transform: translateX(-110%); }
.artist-wave-btn:hover .artist-wave-sheen {
  animation: artistWaveSheen 2.6s ease-in-out infinite;
}
`;

const EASE = 'cubic-bezier(0.32, 0.72, 0.24, 1)';

function EqualizerBars({ aura }: { aura: Aura }) {
  const color = auraRgb(aura);
  return (
    <div className="flex items-end gap-[2.5px] h-[14px]" aria-hidden>
      {[0.15, 0, 0.3, 0.05].map((delay, i) => (
        <span
          key={i}
          className="w-[2.5px] rounded-full"
          style={{
            height: '100%',
            background: color,
            transformOrigin: 'bottom',
            animation: `artistWaveEq ${0.8 + i * 0.07}s ease-in-out ${delay}s infinite`,
            boxShadow: `0 0 6px ${auraRgba(aura, 0.7)}`,
          }}
        />
      ))}
    </div>
  );
}

export const ArtistSoundWave = React.memo(function ArtistSoundWave({
  artistId,
  artistName,
  aura,
}: Props) {
  const { t } = useTranslation();
  const collapsed = useSettingsStore((s) => s.artistWaveCollapsed);
  const setCollapsed = useSettingsStore((s) => s.setArtistWaveCollapsed);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const recommendationMode = useSettingsStore((s) => s.soundwaveMode);
  const [bodyMounted, setBodyMounted] = useState(!collapsed);
  const dislikeVersion = useDislikeVersion();

  useEffect(() => {
    if (!collapsed) {
      setBodyMounted(true);
      return;
    }
    const timer = setTimeout(() => setBodyMounted(false), 560);
    return () => clearTimeout(timer);
  }, [collapsed]);

  const { data, isLoading, isFetching, refetch } = useClusterWave({
    queryKey: ['cluster-wave', 'artist', artistId, hideListened],
    url: artistId
      ? `/recommendations/artist/${encodeURIComponent(artistId)}?hide_listened=${hideListened ? '1' : '0'}`
      : null,
    enabled: !collapsed,
  });

  const currentUrn = usePlayerStore((s) => s.currentTrack?.urn);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

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
  const waveUrns = useMemo(() => new Set(allTracks.map((t) => t.urn)), [allTracks]);
  const isPlayingFromWave = isPlaying && !!currentUrn && waveUrns.has(currentUrn);
  const perf = usePerfMode();
  const sectionBlur = perf.blur(40);

  const orderedClusters = useMemo(() => {
    const byId = new Map(clusters.map((c) => [c.id, c]));
    return CLUSTER_ORDER.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  }, [clusters]);

  const waveCluster = useMemo(
    () => orderedClusters.find((c) => c.id === 'wave') ?? null,
    [orderedClusters],
  );

  useInfiniteWave({
    enabled: !!artistId && !collapsed,
    seedKind: 'artist',
    seedId: artistId,
    initialTracks: waveCluster?.tracks ?? [],
    initialCursor: null,
    hideListened,
  });

  const handlePlay = useCallback(async () => {
    const { play, pause, resume } = usePlayerStore.getState();
    if (allTracks.length > 0) {
      if (isPlayingFromWave) {
        pause();
        return;
      }
      if (currentUrn && waveUrns.has(currentUrn)) {
        resume();
        return;
      }
      play(allTracks[0], allTracks);
      return;
    }

    // A persisted collapsed state intentionally disables the background query.
    // Play remains a direct user intent, so fetch once on demand without forcing
    // the whole animated body open.
    const result = await refetch();
    const fetchedInputs = result.data?.candidates?.length
      ? result.data.candidates
      : (result.data?.allTracks ?? []);
    const fetchedTracks = curateWithLocalTaste(fetchedInputs, {
      hideListened,
      mode: recommendationMode,
      limit: fetchedInputs.length,
    });
    if (fetchedTracks.length > 0) {
      usePlayerStore.getState().play(fetchedTracks[0], fetchedTracks);
    }
  }, [allTracks, currentUrn, hideListened, isPlayingFromWave, recommendationMode, refetch, waveUrns]);

  const handleToggleCollapsed = useCallback(() => {
    if (collapsed) setBodyMounted(true);
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  const lightAura = isLight(aura);
  const showEmpty = !isLoading && orderedClusters.length === 0;
  const playIcon = isPlayingFromWave
    ? lightAura
      ? pauseBlack14
      : pauseWhite14
    : lightAura
      ? playBlack14
      : playWhite14;

  return (
    <section
      className="relative rounded-[1.75rem] overflow-hidden select-none"
      style={
        {
          '--color-accent': auraRgb(aura),
          '--color-accent-glow': auraRgba(aura, 0.32),
          '--color-accent-hover': auraRgb(aura),
          '--color-accent-contrast': lightAura ? '#000' : '#fff',
          background: sectionBlur
            ? `linear-gradient(135deg, ${auraRgba(aura, 0.16)} 0%, rgba(255,255,255,0.025) 45%, ${auraRgba(aura, 0.1)} 100%)`
            : `linear-gradient(135deg, ${auraRgba(aura, 0.16)} 0%, rgba(255,255,255,0.025) 45%, ${auraRgba(aura, 0.1)} 100%), rgba(16,16,20,0.86)`,
          border: `0.5px solid ${auraRgba(aura, 0.26)}`,
          backdropFilter: sectionBlur ? `blur(${sectionBlur}px) saturate(160%)` : undefined,
          WebkitBackdropFilter: sectionBlur ? `blur(${sectionBlur}px) saturate(160%)` : undefined,
          boxShadow: `0 30px 90px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 80px ${auraRgba(aura, 0.22)}`,
          transition: `box-shadow 0.6s ${EASE}`,
        } as React.CSSProperties
      }
    >
      <style>{WAVE_KEYFRAMES}</style>

      {/* top sheen */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${auraRgba(aura, 0.55)}, transparent)`,
        }}
      />
      {/* aura orbs (decorative, clipped by section overflow:hidden) */}
      {perf.bloom && (
        <>
          <div
            className="absolute left-[-40px] top-1/2 w-40 h-40 rounded-full pointer-events-none opacity-50"
            style={{
              background: auraRgba(aura, 0.5),
              filter: `blur(${perf.blur(60)}px)`,
              contain: 'strict',
              transform: 'translateZ(0) translateY(-50%)',
            }}
          />
          <div
            className="absolute right-[-30px] top-1/2 w-32 h-32 rounded-full pointer-events-none opacity-40"
            style={{
              background: auraRgba(aura, 0.4),
              filter: `blur(${perf.blur(56)}px)`,
              contain: 'strict',
              transform: 'translateZ(0) translateY(-50%)',
            }}
          />
        </>
      )}

      <div className="relative" style={{ isolation: 'isolate' }}>
        {/* HEADER — always visible */}
        <div className="flex items-center gap-3 md:gap-4 p-3 md:p-3.5">
          {/* aura badge */}
          <div
            className="relative w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white"
            style={{
              background: `linear-gradient(135deg, ${auraRgba(aura, 0.85)}, ${auraRgba(aura, 0.18)})`,
              border: `0.5px solid ${auraRgba(aura, 0.5)}`,
              boxShadow: `0 10px 28px ${auraRgba(aura, 0.45)}, inset 0 1px 0 rgba(255,255,255,0.22)`,
            }}
          >
            {isPlayingFromWave ? <EqualizerBars aura={aura} /> : <AudioLines size={18} />}
            <span
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(0,0,0,0.78)',
                border: `0.5px solid ${auraRgba(aura, 0.55)}`,
                boxShadow: `0 0 10px ${auraRgba(aura, 0.5)}`,
              }}
            >
              <Sparkles size={8} style={{ color: 'var(--color-accent-contrast)' }} />
            </span>
          </div>

          {/* title + caption */}
          <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="text-[14px] font-black tracking-tight text-white truncate leading-none"
                style={{ textShadow: `0 0 18px ${auraRgba(aura, 0.45)}` }}
              >
                {t('artist.wave.title')}
              </span>
              <span
                className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.18em] px-1.5 py-[2px] rounded-full text-white/90 shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${auraRgba(aura, 0.4)}, rgba(255,255,255,0.05))`,
                  border: `0.5px solid ${auraRgba(aura, 0.45)}`,
                }}
              >
                <Sparkles size={8} />
                AI
              </span>
            </div>
            <p className="text-[11px] text-white/45 truncate" title={artistName}>
              {t('artist.wave.desc', { name: artistName })}
            </p>
          </div>

          {/* play button */}
          <button
            type="button"
            onClick={handlePlay}
            disabled={!artistId || isLoading || isFetching}
            className="artist-wave-btn relative overflow-hidden inline-flex items-center gap-2 h-10 pl-1.5 pr-3.5 rounded-full text-[12.5px] font-bold cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:scale-[1.04] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            style={{
              background: `linear-gradient(180deg, ${auraRgba(aura, 0.95)}, ${auraRgba(aura, 0.7)})`,
              color: lightAura ? '#000' : '#fff',
              border: `0.5px solid ${auraRgba(aura, 0.55)}`,
              boxShadow: `0 12px 28px ${auraRgba(aura, 0.45)}, inset 0 1px 0 rgba(255,255,255,0.3)`,
            }}
          >
            <span
              className="artist-wave-sheen absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
                // Beauty/medium keep the original always-on idle sheen; light
                // drops it to playing-only (hover still triggers it via CSS).
                animation:
                  perf.idleAnim || isPlayingFromWave
                    ? 'artistWaveSheen 2.6s ease-in-out infinite'
                    : undefined,
              }}
            />
            <span
              className="relative w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: lightAura ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.22)',
                border: `0.5px solid ${lightAura ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)'}`,
              }}
            >
              {playIcon}
            </span>
            <span className="relative tracking-wide whitespace-nowrap">
              {isPlayingFromWave ? t('artist.wave.pause') : t('artist.wave.playAll')}
            </span>
          </button>

          {/* chevron (rotates via CSS transform transition) */}
          <button
            type="button"
            onClick={handleToggleCollapsed}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
            className="relative w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-110 text-white/55 hover:text-white shrink-0"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${auraRgba(aura, 0.22)}`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05)`,
            }}
          >
            <ChevronDown
              size={14}
              className="transition-transform"
              style={{
                transition: `transform 0.5s ${EASE}`,
                transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              }}
            />
          </button>
        </div>

        {/* COLLAPSIBLE BODY — pure CSS grid-template-rows 0fr ↔ 1fr */}
        <div
          className="grid"
          style={{
            gridTemplateRows: collapsed ? '0fr' : '1fr',
            transition: `grid-template-rows 0.55s ${EASE}`,
          }}
        >
          <div className="overflow-hidden min-h-0">
            {bodyMounted && (
              <div
                style={{
                  transition: `opacity 0.4s ${EASE}`,
                  transitionDelay: '0.12s',
                  opacity: collapsed ? 0 : 1,
                }}
              >
              {/* divider — sits between header and clusters when expanded */}
              <div
                className="mx-4 md:mx-5 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${auraRgba(aura, 0.28)}, transparent)`,
                }}
              />

              <div className="relative p-5 md:p-6 pt-6 md:pt-7">
                <AmbientLayer particleCount={14} blur={70} intensity={0.5} />

                {isLoading ? (
                  <ClusterSkeletonState />
                ) : showEmpty ? (
                  <ClusterEmptyState
                    title={t('artist.wave.empty')}
                    description={t('artist.wave.emptyDesc')}
                  />
                ) : (
                  <div className="relative flex flex-col gap-7">
                    {orderedClusters.map((c, idx) =>
                      c.id === 'neighbors' && c.neighbors ? (
                        <NeighborsRow
                          key={c.id}
                          title={t(`artist.wave.cluster.${c.id}`)}
                          description={t(`artist.wave.cluster.${c.id}Desc`)}
                          icon={CLUSTER_ICON[c.id]}
                          index={idx}
                          cluster={c}
                          queue={allTracks}
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
                          queue={allTracks}
                        />
                      ),
                    )}
                  </div>
                )}
              </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});
