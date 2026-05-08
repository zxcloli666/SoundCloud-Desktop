import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLines, playBlack14, RefreshCw, Search, Sparkles } from '../../../lib/icons';
import { isUrnLiked } from '../../../lib/likes';
import {
  fetchWaveTailFromSeed,
  hydrateByIds,
  type SoundWaveMode,
  useSoundWave,
  useSoundWaveSearch,
} from '../../../lib/soundwave';
import { useAuthStore } from '../../../stores/auth';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import { AmbientLayer } from './ambient';
import { RecommendationsHeader, SearchHeader } from './headers';
import { HideLikedToggle } from './hide-liked-toggle';
import { LanguageFilter } from './language-filter';
import { ModeToggle } from './mode-toggle';
import { RecommendationsStrip, SkeletonStrip } from './strip';
import { WaveTrackHeader } from './track-header';
import { useInfiniteWave } from './use-infinite-wave';
import { VibeSearchBar, type VibeSearchBarHandle } from './vibe-search-bar';
import { LiveWaveform } from './waveform';

/**
 * Fetch more wave recommendations seeded by the last track the user is
 * currently listening to. This is what makes the wave infinite — we keep
 * asking "what's similar to where we are now?".
 */
async function fetchWaveTail(
  languages: string[],
  mode: SoundWaveMode,
  hideLiked: boolean,
): Promise<Track[]> {
  const q = usePlayerStore.getState().queue;
  const last = q.length > 0 ? q[q.length - 1] : null;
  if (!last) return [];
  const trackId = String(last.urn.split(':').pop() ?? '');
  if (!trackId) return [];

  const recs = await fetchWaveTailFromSeed(trackId, { languages, mode });
  if (!recs.length) return [];
  const tracks = await hydrateByIds(recs);
  return hideLiked ? tracks.filter((t) => !t.user_favorite && !isUrnLiked(t.urn)) : tracks;
}

export const SoundWaveBlock = React.memo(function SoundWaveBlock() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedLanguages = useSettingsStore((s) => s.soundwaveLanguages);
  const setSelectedLanguages = useSettingsStore((s) => s.setSoundwaveLanguages);
  const mode = useSettingsStore((s) => s.soundwaveMode);
  const hideLiked = useSettingsStore((s) => s.soundwaveHideLiked);
  const setHideLiked = useSettingsStore((s) => s.setSoundwaveHideLiked);

  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeQuery, setActiveQuery] = useState('');
  const searchRef = useRef<VibeSearchBarHandle>(null);

  const stableLanguages = useMemo(() => [...selectedLanguages].sort(), [selectedLanguages]);

  const { data, isLoading, isFetching, refetch } = useSoundWave({
    enabled: isAuthenticated,
    languages: stableLanguages,
    mode,
    hideLiked,
  });

  const {
    data: searchData,
    isLoading: searchLoading,
    isFetching: searchFetching,
  } = useSoundWaveSearch({ q: activeQuery, languages: stableLanguages });

  const recTracks = useMemo(() => data?.tracks ?? [], [data]);
  const searchTracks = useMemo(() => searchData?.tracks ?? [], [searchData]);

  const isSearchMode = activeQuery.length >= 2;
  const tracks = isSearchMode ? searchTracks : recTracks;
  const searchBusy = searchLoading || searchFetching;

  const waveTrack = currentTrack ?? tracks[0] ?? null;
  const isCurrent = !!currentTrack && waveTrack?.urn === currentTrack.urn;

  const fetchMore = useCallback(
    () => fetchWaveTail(stableLanguages, mode, hideLiked),
    [stableLanguages, mode, hideLiked],
  );

  useInfiniteWave({
    enabled: isAuthenticated && !isSearchMode,
    tracks: recTracks,
    fetchMore,
  });

  const handleSubmitSearch = useCallback((q: string) => {
    setActiveQuery(q);
  }, []);

  const handleClearSearch = useCallback(() => {
    searchRef.current?.clear();
    setActiveQuery('');
  }, []);

  if (!isAuthenticated) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
    }
  };

  const handlePlayAll = () => {
    if (!tracks.length) return;
    usePlayerStore.getState().play(tracks[0], tracks);
  };

  const spinning = isRefreshing || isFetching;
  const showCold = !isSearchMode && !isLoading && recTracks.length === 0;
  const showSearchEmpty = isSearchMode && !searchBusy && searchTracks.length === 0;

  return (
    <section
      className="relative overflow-hidden rounded-[34px] glass-featured select-none"
      style={{
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.04) inset, 0 10px 60px rgba(0,0,0,0.45), 0 0 60px var(--color-accent-glow)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <AmbientLayer particleCount={10} blur={35} intensity={0.5} />

      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            'linear-gradient(180deg, rgba(8,8,10,0.45) 0%, rgba(8,8,10,0.35) 45%, rgba(8,8,10,0.85) 100%)',
          contain: 'strict',
        }}
      />

      <div className="relative p-6 flex flex-col gap-5" style={{ isolation: 'isolate' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="relative w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent), rgba(255,255,255,0.12))',
                boxShadow: '0 0 24px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              <AudioLines size={18} style={{ color: 'var(--color-accent-contrast)' }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="soundwave-title text-[20px] font-bold tracking-tight leading-none">
                  SoundWave
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
              <p className="text-[11.5px] text-white/50 mt-1 truncate">{t('soundwave.tagline')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <HideLikedToggle value={hideLiked} onChange={setHideLiked} />
            <ModeToggle />
            <LanguageFilter selected={selectedLanguages} onChange={setSelectedLanguages} />
            <button
              type="button"
              onClick={handleRefresh}
              disabled={spinning}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.14] transition-colors duration-200 text-white/70 hover:text-white/95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('soundwave.refresh')}
            >
              <RefreshCw size={13} className={spinning ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handlePlayAll}
              disabled={tracks.length === 0}
              className="flex items-center gap-2 pl-2.5 pr-4 h-10 rounded-full font-semibold text-[13px] transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] hover:scale-[1.03]"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-accent-contrast)',
                boxShadow:
                  '0 6px 22px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
              title={t('soundwave.playAll')}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.9)' }}
              >
                {playBlack14}
              </span>
              {t('soundwave.playAll')}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {waveTrack ? (
            <WaveTrackHeader
              track={waveTrack}
              queue={tracks.length ? tracks : [waveTrack]}
              isCurrent={isCurrent}
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-white/90 leading-tight">
                  {t('soundwave.idleTitle')}
                </p>
                <p className="text-[12px] text-white/45 mt-0.5 truncate">
                  {t('soundwave.idleSub')}
                </p>
              </div>
            </div>
          )}

          <LiveWaveform track={waveTrack} isCurrent={isCurrent} />
        </div>

        <VibeSearchBar
          ref={searchRef}
          onSubmit={handleSubmitSearch}
          onClear={handleClearSearch}
          loading={searchBusy}
          active={isSearchMode}
        />

        <div className="min-h-[280px]">
          {isSearchMode ? (
            <>
              <SearchHeader
                query={activeQuery}
                count={searchTracks.length}
                onClear={handleClearSearch}
              />
              {searchBusy ? (
                <SkeletonStrip />
              ) : showSearchEmpty ? (
                <EmptyState
                  icon={<Search size={16} style={{ color: 'var(--color-accent)' }} />}
                  title={t('soundwave.searchEmptyTitle')}
                  desc={t('soundwave.searchEmptyDesc')}
                />
              ) : (
                <RecommendationsStrip tracks={searchTracks} />
              )}
            </>
          ) : (
            <>
              <RecommendationsHeader />
              {isLoading ? (
                <SkeletonStrip />
              ) : showCold ? (
                <EmptyState
                  icon={<Sparkles size={18} style={{ color: 'var(--color-accent)' }} />}
                  title={t('soundwave.coldTitle')}
                  desc={t('soundwave.coldDesc')}
                />
              ) : (
                <RecommendationsStrip tracks={recTracks} />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
});

/** Stateless "nothing here yet" card used for both cold-start and no-search-results. */
const EmptyState = React.memo(function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="relative py-6 px-5 rounded-2xl bg-white/[0.025] border border-white/[0.05] flex items-center gap-4">
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
        style={{
          background: 'linear-gradient(135deg, var(--color-accent-glow), rgba(255,255,255,0.04))',
          border: '1px solid var(--color-accent-glow)',
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white/90">{title}</p>
        <p className="text-[11.5px] text-white/45 mt-0.5">{desc}</p>
      </div>
    </div>
  );
});
