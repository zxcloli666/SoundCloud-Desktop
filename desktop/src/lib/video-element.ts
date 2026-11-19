import { type RefObject, useSyncExternalStore } from 'react';

export type VideoHost = 'player-cover' | 'player-background' | 'player-view' | 'moments';

const RANK: Record<VideoHost, number> = {
  moments: 0,
  'player-cover': 1,
  'player-background': 1,
  'player-view': 2,
};
const H264 = 'video/mp4; codecs="avc1.640028"';

interface Claim {
  host: VideoHost;
  slot: HTMLElement;
}

let element: HTMLVideoElement | null = null;
let claims: Claim[] = [];
let owner: Claim | null = null;
let opaqueIn: VideoHost | null = null;
const ownerListeners = new Set<() => void>();
const opaqueListeners = new Set<() => void>();

export function videoElement(): HTMLVideoElement {
  if (element) return element;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.disableRemotePlayback = true;
  video.preload = 'auto';
  video.className = 'absolute inset-0 size-full object-cover';
  element = video;
  return video;
}

export function canPlayH264(): boolean {
  return videoElement().canPlayType(H264) !== '';
}

export function claimVideo(host: VideoHost, slot: HTMLElement): () => void {
  const claim = { host, slot };
  claims = [...claims, claim];
  settleOwner();
  return () => {
    claims = claims.filter((item) => item !== claim);
    settleOwner();
  };
}

export function useVideoOwner(slot: RefObject<HTMLElement | null>): boolean {
  return useSyncExternalStore(subscribeOwner, () => !!owner && owner.slot === slot.current);
}

export function setVideoOpaque(host: VideoHost, opaque: boolean): void {
  const next = opaque ? host : opaqueIn === host ? null : opaqueIn;
  if (next === opaqueIn) return;
  opaqueIn = next;
  if (next) document.documentElement.dataset.videoOpaque = next;
  else delete document.documentElement.dataset.videoOpaque;
  for (const listener of opaqueListeners) listener();
}

export function videoOpaqueIn(): VideoHost | null {
  return opaqueIn;
}

export function subscribeVideoOpaque(listener: () => void): () => void {
  opaqueListeners.add(listener);
  return () => opaqueListeners.delete(listener);
}

export function useVideoOpaque(): VideoHost | null {
  return useSyncExternalStore(subscribeVideoOpaque, videoOpaqueIn);
}

function subscribeOwner(listener: () => void): () => void {
  ownerListeners.add(listener);
  return () => ownerListeners.delete(listener);
}

function settleOwner() {
  const next = claims.reduce<Claim | null>(
    (best, claim) => (!best || RANK[claim.host] >= RANK[best.host] ? claim : best),
    null,
  );
  if (next === owner) return;
  if (owner) setVideoOpaque(owner.host, false);
  owner = next;
  const video = videoElement();
  if (next) {
    video.style.objectFit = next.host === 'player-view' ? 'contain' : '';
    next.slot.appendChild(video);
  } else {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
  for (const listener of ownerListeners) listener();
}
