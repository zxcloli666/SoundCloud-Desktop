import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RIVER_KEYFRAMES } from '../components/home/river/keyframes';
import { MOMENTS_KEYFRAMES } from '../components/moments/keyframes';
import {
  MomentsBackdrop,
  MomentsLoading,
  MomentsTopBar,
  MomentsWaiting,
} from '../components/moments/MomentsChrome';
import { MomentsStage } from '../components/moments/MomentsStage';
import { useMomentsFeed } from '../components/moments/use-moments-feed';
import { useWaveSource } from '../components/moments/use-wave-source';
import type { Track } from '../stores/player';

export function Moments() {
  const location = useLocation();
  const navigate = useNavigate();
  const startUrn = (location.state as { startUrn?: string } | null)?.startUrn;
  const feed = useMomentsFeed(useWaveSource(startUrn));
  const current = feed.tracks[feed.index];
  const { listenFull: startFull } = feed;
  const listenFull = useCallback(
    (track: Track) => {
      startFull(track);
      navigate('/home');
    },
    [startFull, navigate],
  );

  return (
    <div data-ui="moments" className="relative flex h-full w-full flex-col overflow-hidden">
      <style>{MOMENTS_KEYFRAMES + RIVER_KEYFRAMES}</style>
      <MomentsBackdrop artworkUrl={current?.artwork_url ?? null} />
      <MomentsTopBar />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col" style={{ isolation: 'isolate' }}>
        {feed.status === 'loading' ? (
          <MomentsLoading />
        ) : feed.status === 'empty' ? (
          <MomentsWaiting onRetry={feed.reload} />
        ) : (
          <MomentsStage
            tracks={feed.tracks}
            index={feed.index}
            go={feed.go}
            toggle={feed.toggle}
            listenFull={listenFull}
          />
        )}
      </div>
    </div>
  );
}
