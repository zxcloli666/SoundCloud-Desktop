import { useQuery } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { api } from '../../../lib/api';
import {
  getCurrentTime,
  getDuration,
  getPlaybackClock,
  subscribeSeek,
  upcomingTrack,
} from '../../../lib/audio';
import { isLocalUrn } from '../../../lib/local-library';
import { getMomentClock } from '../../../lib/moments/channel';
import { videoSource } from '../../../lib/video-cache';
import type { VideoHost } from '../../../lib/video-element';
import { pickVideo } from '../../../lib/video-pick';
import type { Track } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import { useTrackVideo, useVideoAllowed, type VideoFeed } from './useTrackVideo';

const FRESH_MS = 30 * 60_000;
const PREFETCH_LEFT_SEC = 30;
const PREFETCH_EVERY_MS = 5_000;
const DIM =
  "after:absolute after:inset-0 after:content-[''] after:bg-gradient-to-b after:from-black/45 after:via-black/55 after:to-black/80";

type PlayerHost = Extract<VideoHost, `player-${string}`>;

export const VideoLayer = React.memo(function VideoLayer(feed: VideoFeed) {
  const slotRef = useTrackVideo(feed);
  return (
    <div
      ref={slotRef}
      data-ui="track-video"
      data-place={feed.host}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${feed.host === 'room' ? '' : 'bg-black'} ${feed.host === 'player-background' ? DIM : ''}`}
      style={{ opacity: 0 }}
    />
  );
});

export function onPlayerSeek(listener: () => void) {
  return subscribeSeek(() => listener());
}

export const PlayerVideo = React.memo(function PlayerVideo({
  track,
  host,
}: {
  track: Track;
  host: PlayerHost;
}) {
  const allowed = useVideoAllowed();
  const videos = useTrackVideos(track, allowed);
  usePrefetchUpcoming(allowed && host !== 'player-view');
  return (
    <VideoLayer
      host={host}
      urn={track.urn}
      videos={videos}
      clock={getPlaybackClock}
      onSeek={onPlayerSeek}
    />
  );
});

export const MomentVideo = React.memo(function MomentVideo({ track }: { track: Track }) {
  return (
    <VideoLayer
      host="moments"
      urn={track.urn}
      videos={track.videos}
      clock={() => getMomentClock(track.urn)}
    />
  );
});

export function useTrackVideos(track: Track, allowed: boolean) {
  const ask = allowed && track.videos === undefined && !isLocalUrn(track.urn);
  const { data } = useQuery({
    queryKey: ['track', track.urn],
    queryFn: () => api<Track>(`/tracks/${encodeURIComponent(track.urn)}`),
    enabled: ask,
    staleTime: FRESH_MS,
  });
  return track.videos ?? data?.videos;
}

export function usePrefetchUpcoming(allowed: boolean) {
  useEffect(() => {
    if (!allowed) return;
    let done: string | null = null;
    const check = () => {
      const left = getDuration() - getCurrentTime();
      const next = upcomingTrack();
      if (!next || next.urn === done || getDuration() <= 0 || left > PREFETCH_LEFT_SEC) return;
      done = next.urn;
      const { videoOrder, videoOff } = useSettingsStore.getState();
      const picked = pickVideo(next.videos, { order: videoOrder, off: videoOff }, new Set());
      if (picked) videoSource(picked.url).catch(() => {});
    };
    const timer = window.setInterval(check, PREFETCH_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [allowed]);
}
