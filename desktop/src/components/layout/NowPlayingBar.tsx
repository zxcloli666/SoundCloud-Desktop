import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { getCurrentTime, getDuration, subscribe } from '../../lib/audio';
import { art, formatTime } from '../../lib/formatters';
import { usePerfMode } from '../../lib/perf';
import { usePlayerStore } from '../../stores/player';
import { useChatDockWidth } from '../chat/shell/useChatDockWidth';
import { useLayoutMenu } from './LayoutMenu';
import { DockLoadingRing, useLoadProgress } from './player/load-progress';
import { PillTrack } from './player/PillTrack';
import {
  HiddenPopovers,
  type PlayerContext,
  ToolButtons,
  TrackButtons,
  TransportButtons,
} from './player/PlayerButtons';
import { WaveSeek } from './player/WaveSeek';
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
    const right = useChatDockWidth();
    const left = sidebarWidth(sidebarCollapsed);
    const layoutMenu = useLayoutMenu('player');
    const ctx: PlayerContext = { onQueueToggle, queueOpen };

    return (
      <div
        className="npb"
        data-ui="player"
        style={{
          left,
          right,
          transitionDuration: perf.mode === 'light' ? '0ms' : undefined,
        }}
      >
        <BackgroundGlow />

        <div
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
            <div className="npb-row">
              <div className="npb-left">
                <PillTrack loadProgress={loadProgress} />
                <TrackButtons ctx={ctx} />
              </div>
              <TransportButtons ctx={ctx} />
              <ToolButtons ctx={ctx} />
            </div>

            <div className="npb-lane">
              <TimeNow />
              <WaveSeek />
              <TimeTotal />
            </div>
          </div>
          <HiddenPopovers ctx={ctx} />
        </div>
        {layoutMenu.menu}
      </div>
    );
  },
);
