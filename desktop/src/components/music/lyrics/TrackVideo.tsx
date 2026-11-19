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
import { pickVideo } from '../../../lib/video-pick';
import type { Track } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import { useTrackVideo, useVideoAllowed, type VideoFeed } from './useTrackVideo';

const FRESH_MS = 30 * 60_000;
const PREFETCH_LEFT_SEC = 30;
const PREFETCH_EVERY_MS = 5_000;

const VideoLayer = React.memo(function VideoLayer(feed: VideoFeed) {
  const slotRef = useTrackVideo(feed);
  return (
    <div
      ref={slotRef}
      data-ui="track-video"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-black"
      style={{ opacity: 0 }}
    />
  );
});

function onPlayerSeek(listener: () => void) {
  return subscribeSeek(() => listener());
}

export const PlayerVideo = React.memo(function PlayerVideo({ track }: { track: Track }) {
  const allowed = useVideoAllowed();
  const ask = allowed && track.videos === undefined && !isLocalUrn(track.urn);
  const { data } = useQuery({
    queryKey: ['track', track.urn],
    queryFn: () => api<Track>(`/tracks/${encodeURIComponent(track.urn)}`),
    enabled: ask,
    staleTime: FRESH_MS,
  });
  usePrefetchUpcoming(allowed);
  return (
    <VideoLayer
      host="player"
      urn={track.urn}
      videos={track.videos ?? data?.videos}
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

function usePrefetchUpcoming(allowed: boolean) {
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
