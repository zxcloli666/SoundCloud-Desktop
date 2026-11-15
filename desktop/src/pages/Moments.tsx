import { useLocation } from 'react-router-dom';
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

export function Moments() {
  const location = useLocation();
  const startUrn = (location.state as { startUrn?: string } | null)?.startUrn;
  const feed = useMomentsFeed(startUrn);
  const current = feed.tracks[feed.index];

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
            listenFull={feed.listenFull}
          />
        )}
      </div>
    </div>
  );
}
