import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getCurrentTime, getDuration, subscribe } from '../../lib/audio';
import { art, formatTime } from '../../lib/formatters';
import { usePerfMode } from '../../lib/perf';
import { usePlayerStore } from '../../stores/player';
import { useLayoutMenu } from './LayoutMenu';
import { DockLoadingRing, useLoadProgress } from './player/load-progress';
import { PillTrack } from './player/PillTrack';
import { HiddenPopovers, type PlayerContext, Zone } from './player/PlayerButtons';
import { NextBtn, PlayPauseBtn, PrevBtn } from './player/transport';
import { useDockHeight, useStackedRow } from './player/use-dock';
import { WaveSeek } from './player/WaveSeek';
import { ZoneBoard } from './player/zone-board';
import { sidebarWidth, useSidebarCollapsed } from './SidebarChrome';

const TimeNow = React.memo(() => {
  const current = useSyncExternalStore(subscribe, () => Math.floor(getCurrentTime()));
  return <b className="npb-time is-now">{formatTime(current)}</b>;
});

const TimeTotal = React.memo(() => {
  const duration = useSyncExternalStore(subscribe, getDuration);
  return <span className="npb-time">{formatTime(duration)}</span>;
});

function useDocHidden(): boolean {
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );
  useEffect(() => {
    const onChange = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return hidden;
}

const BackgroundGlow = React.memo(() => {
  const perf = usePerfMode();
  const artworkUrl = usePlayerStore(
    (s) => s.currentTrack?.artwork_url || s.currentTrack?.user?.avatar_url,
  );
  const artwork = art(artworkUrl, 't200x200');

  if (!perf.bloom || !artwork) return null;
  return (
    <div
      className="absolute inset-0 opacity-[0.05] blur-3xl pointer-events-none"
      style={{
        backgroundImage: `url(${artwork})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        contain: 'strict',
        transform: 'translateZ(0)',
      }}
    />
  );
});

export const NowPlayingBar = React.memo(
  ({ onQueueToggle, queueOpen }: { onQueueToggle: () => void; queueOpen: boolean }) => {
    const isPlaying = usePlayerStore((s) => s.isPlaying);
    const hidden = useDocHidden();
    const playingNow = isPlaying && !hidden;
    const loadProgress = useLoadProgress();
    const sidebarCollapsed = useSidebarCollapsed();
    const perf = usePerfMode();
    const left = sidebarWidth(sidebarCollapsed);
    const layoutMenu = useLayoutMenu('player');
    const dock = useRef<HTMLDivElement>(null);
    const stacked = useStackedRow(dock);
    useDockHeight(dock);
    const ctx: PlayerContext = { onQueueToggle, queueOpen };

    return (
      <div
        className="npb"
        data-ui="player"
        style={{
          left,
          right: 'var(--right-dock)',
          transitionDuration: perf.mode === 'light' ? '0ms' : undefined,
        }}
      >
        <BackgroundGlow />

        <div
          ref={dock}
          className={`npb-dock${loadProgress != null ? ' is-loading' : ''}`}
          data-playing={playingNow ? 'true' : 'false'}
          onContextMenu={(e) => {
            if ((e.target as HTMLElement).closest('.npb-meta')) return;
            layoutMenu.onContextMenu(e);
          }}
        >
          <div className="npb-glass" />
          <DockLoadingRing progress={loadProgress} />

          <div className="npb-content">
            <ZoneBoard surface="player">
              <div className="npb-row" data-stacked={stacked ? 'true' : undefined}>
                <div className="npb-left">
                  <PillTrack loadProgress={loadProgress} />
                  <Zone zone="left" ctx={ctx} className="npb-track-btns" />
                  <Zone zone="before" ctx={ctx} className="npb-near zone-near" />
                </div>
                <div className="npb-transport" data-ui="player-transport">
                  <PrevBtn />
                  <PlayPauseBtn />
                  <NextBtn />
                </div>
                <div className="npb-right">
                  <Zone zone="after" ctx={ctx} className="npb-near zone-near" />
                  <Zone zone="right" ctx={ctx} className="npb-tool-btns" />
                </div>
              </div>
            </ZoneBoard>

            <div className="npb-lane">
              <TimeNow />
              <WaveSeek />
              <TimeTotal />
            </div>
          </div>
          <HiddenPopovers surface="player" ctx={ctx} />
        </div>
        {layoutMenu.menu}
      </div>
    );
  },
);
