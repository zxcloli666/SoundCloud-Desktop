import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../lib/api';
import { AudioLines, playBlack14, Sparkles } from '../../../lib/icons';
import { hydrateByIds, type RecommendResult, useSoundWaveSimilar } from '../../../lib/soundwave';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import { AmbientLayer } from './ambient';
import { RecommendationsStrip, SkeletonStrip } from './strip';
import { useInfiniteWave } from './use-infinite-wave';

interface Props {
  /** URN of the anchor track (e.g. "soundcloud:tracks:123456"). */
  trackUrn: string;
}

async function fetchSimilarTail(anchorTrackId: string, excludeUrns: string[]): Promise<Track[]> {
  if (!anchorTrackId) return [];
  const qs = new URLSearchParams({ limit: '20' });
  const excludeIds = excludeUrns.map((u) => u.split(':').pop()).filter(Boolean) as string[];
  if (excludeIds.length) qs.set('exclude', excludeIds.join(','));
  const recs = await api<RecommendResult[]>(
    `/recommendations/similar/${encodeURIComponent(anchorTrackId)}?${qs}`,
  ).catch(() => [] as RecommendResult[]);
  if (!recs.length) return [];
  return hydrateByIds(recs);
}

/**
 * "Similar tracks" shelf for the TrackPage — same visual language as the home
 * SoundWaveBlock but without the live waveform, and always anchored on the
 * current track.
 */
export const SoundWaveSimilarBlock = React.memo(function SoundWaveSimilarBlock({
  trackUrn,
}: Props) {
  const { t } = useTranslation();
  const trackId = useMemo(() => trackUrn.split(':').pop() ?? '', [trackUrn]);

  const { data, isLoading } = useSoundWaveSimilar({ trackId });
  const tracks = useMemo(() => data?.tracks ?? [], [data]);

  const fetchMore = useCallback(
    () =>
      fetchSimilarTail(
        trackId,
        tracks.map((t) => t.urn),
      ),
    [trackId, tracks],
  );

  useInfiniteWave({
    enabled: !!trackId,
    tracks,
    fetchMore,
  });

  const hasTracks = tracks.length > 0;
  const showCold = !isLoading && !hasTracks;

  const handlePlayAll = () => {
    if (!hasTracks) return;
    usePlayerStore.getState().play(tracks[0], tracks);
  };

  return (
    <section
      className="relative overflow-hidden rounded-[34px] glass-featured select-none"
      style={{
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.04) inset, 0 10px 40px rgba(0,0,0,0.35), 0 0 40px var(--color-accent-glow)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <AmbientLayer particleCount={6} blur={30} intensity={0.35} />

      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            'linear-gradient(180deg, rgba(8,8,10,0.45) 0%, rgba(8,8,10,0.35) 45%, rgba(8,8,10,0.85) 100%)',
          contain: 'strict',
        }}
      />

      <div className="relative p-5 flex flex-col gap-4" style={{ isolation: 'isolate' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="relative w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent), rgba(255,255,255,0.12))',
                boxShadow: '0 0 20px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              <AudioLines size={15} style={{ color: 'var(--color-accent-contrast)' }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="soundwave-title text-[16px] font-bold tracking-tight leading-none">
                  {t('soundwave.similar')}
                </h2>
                <span
                  className="relative overflow-hidden inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-[3px] rounded-full text-white/90"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--color-accent-glow), rgba(255,255,255,0.06))',
                    border: '1px solid var(--color-accent-glow)',
                  }}
                >
                  <Sparkles size={9} style={{ color: 'var(--color-accent)' }} />
                  AI
                </span>
              </div>
              <p className="text-[11px] text-white/50 mt-1 truncate">
                {t('soundwave.similarDesc')}
              </p>
            </div>
          </div>

          {hasTracks && (
            <button
              type="button"
              onClick={handlePlayAll}
              className="flex items-center gap-2 pl-2.5 pr-4 h-9 rounded-full font-semibold text-[12.5px] transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer active:scale-[0.97] hover:scale-[1.03]"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-accent-contrast)',
                boxShadow:
                  '0 5px 18px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
              title={t('soundwave.playAll')}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.9)' }}
              >
                {playBlack14}
              </span>
              {t('soundwave.playAll')}
            </button>
          )}
        </div>

        <div className="min-h-[240px]">
          {isLoading ? (
            <SkeletonStrip count={8} width={170} />
          ) : showCold ? (
            <div className="relative py-6 px-5 rounded-2xl bg-white/[0.025] border border-white/[0.05] flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background:
                    'linear-gradient(135deg, var(--color-accent-glow), rgba(255,255,255,0.04))',
                  border: '1px solid var(--color-accent-glow)',
                }}
              >
                <Sparkles size={17} style={{ color: 'var(--color-accent)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white/90">
                  {t('soundwave.similarEmpty')}
                </p>
                <p className="text-[11.5px] text-white/45 mt-0.5">{t('soundwave.similarCold')}</p>
              </div>
            </div>
          ) : (
            <RecommendationsStrip tracks={tracks} width={170} />
          )}
        </div>
      </div>
    </section>
  );
});
