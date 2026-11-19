import { type RefObject, useEffect, useRef } from 'react';
import { useFailedKinds } from '../../../lib/video-cache';
import { driveVideo } from '../../../lib/video-drive';
import {
  canPlayH264,
  claimVideo,
  useVideoOwner,
  type VideoHost,
  videoElement,
} from '../../../lib/video-element';
import { type PickedVideo, pickVideo } from '../../../lib/video-pick';
import type { PlaybackClock } from '../../../lib/video-sync';
import type { TrackVideo } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';

export interface VideoFeed {
  host: VideoHost;
  urn: string;
  videos: TrackVideo[] | undefined;
  clock: () => PlaybackClock;
  onSeek?: (listener: () => void) => () => void;
}

export function useVideoAllowed(): boolean {
  const enabled = useSettingsStore((s) => s.videoEnabled);
  return enabled && canPlayH264();
}

export function usePickedVideo(
  urn: string | null,
  videos: TrackVideo[] | undefined,
): PickedVideo | null {
  const allowed = useVideoAllowed();
  const order = useSettingsStore((s) => s.videoOrder);
  const off = useSettingsStore((s) => s.videoOff);
  const failed = useFailedKinds(urn);
  return allowed ? pickVideo(videos, { order, off }, failed) : null;
}

export function useTrackVideo(feed: VideoFeed): RefObject<HTMLDivElement | null> {
  const slotRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef(feed);
  feedRef.current = feed;
  const picked = usePickedVideo(feed.urn, feed.videos);
  const owner = useVideoOwner(slotRef);
  const still = useStill();
  const has = picked !== null;

  useEffect(() => {
    const slot = slotRef.current;
    if (!has || !slot) return;
    return claimVideo(feed.host, slot);
  }, [feed.host, has]);

  useEffect(() => {
    const slot = slotRef.current;
    if (!owner || !picked || !slot) return;
    const current = feedRef.current;
    return driveVideo({
      host: current.host,
      urn: current.urn,
      video: videoElement(),
      slot,
      picked,
      still,
      clock: () => feedRef.current.clock(),
      onSeek: current.onSeek,
    });
  }, [owner, picked, still]);

  return slotRef;
}

function useStill(): boolean {
  const userSet = useSettingsStore((s) => s.videoUserSet);
  return !userSet && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
