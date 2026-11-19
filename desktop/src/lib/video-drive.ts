import { markVideoFailed, videoSource } from './video-cache';
import { setVideoOpaque, type VideoHost } from './video-element';
import type { PickedVideo } from './video-pick';
import {
  clockTime,
  DRIFT_HOLD_SEC,
  type PlaybackClock,
  SYNC_EVERY_MS,
  syncStep,
  videoTarget,
} from './video-sync';

export const FADE_MS = 300;

const STALL_MS = 8_000;
const END_HOLD_MS = 1_500;
const HAVE_METADATA = 1;
const HAVE_CURRENT_DATA = 2;

export interface Drive {
  host: VideoHost;
  urn: string;
  video: HTMLVideoElement;
  slot: HTMLElement;
  picked: PickedVideo;
  clock: () => PlaybackClock;
  still: boolean;
  onSeek?: (listener: () => void) => () => void;
}

export function driveVideo({ host, urn, video, slot, picked, clock, still, onSeek }: Drive) {
  let stopped = false;
  let shown = false;
  let ready = false;
  let wantPlay = false;
  let playAfterSeek = false;
  let endedAt = 0;
  let nudging = false;
  let stallTimer = 0;
  let opaqueTimer = 0;

  const show = (on: boolean) => {
    if (on === shown) return;
    shown = on;
    slot.style.transition = `opacity ${FADE_MS}ms ease-out`;
    slot.style.opacity = on ? '1' : '0';
    window.clearTimeout(opaqueTimer);
    if (on) opaqueTimer = window.setTimeout(() => setVideoOpaque(host, true), FADE_MS);
    else setVideoOpaque(host, false);
  };

  const play = () => {
    wantPlay = true;
    if (video.paused) void video.play().catch(() => {});
  };

  const pause = () => {
    wantPlay = false;
    playAfterSeek = false;
    window.clearTimeout(stallTimer);
    if (!video.paused) video.pause();
  };

  const seekTo = (time: number) => {
    if (Math.abs(video.currentTime - time) > DRIFT_HOLD_SEC) video.currentTime = time;
  };

  const sync = () => {
    if (stopped || video.readyState < HAVE_METADATA) return;
    if (document.visibilityState === 'hidden') return pause();
    if (still) {
      pause();
      seekTo(0);
      return show(ready);
    }
    const now = clock();
    if (picked.loop) {
      video.playbackRate = 1;
      if (now.playing) play();
      else pause();
      return show(ready);
    }
    const target = videoTarget(clockTime(now, performance.now()), picked.offsetMs);
    const step = syncStep(target, video.currentTime, video.duration, now.rate, nudging);
    nudging = step.kind === 'nudge';
    if (step.kind === 'wait') {
      pause();
      seekTo(0);
      return show(false);
    }
    if (step.kind === 'end') {
      pause();
      endedAt ||= performance.now();
      return show(ready && performance.now() - endedAt < END_HOLD_MS);
    }
    endedAt = 0;
    if (!now.playing) {
      pause();
      seekTo(target);
      return show(ready);
    }
    video.playbackRate = step.rate;
    if (video.paused) {
      if (Math.abs(video.currentTime - target) > DRIFT_HOLD_SEC) {
        playAfterSeek = true;
        wantPlay = true;
        video.currentTime = target;
      } else play();
    } else if (step.kind === 'jump') {
      video.currentTime = step.time;
    }
    show(ready);
  };

  const fail = (reason: string) => {
    if (stopped) return;
    stop();
    markVideoFailed(urn, picked.kind, reason);
  };

  const armStall = () => {
    window.clearTimeout(stallTimer);
    if (wantPlay) stallTimer = window.setTimeout(() => fail('stalled'), STALL_MS);
  };

  const onPlaying = () => {
    window.clearTimeout(stallTimer);
    ready = true;
    sync();
  };

  const onSeeked = () => {
    if (video.readyState >= HAVE_CURRENT_DATA) ready = true;
    if (playAfterSeek && !stopped) {
      playAfterSeek = false;
      void video.play().catch(() => {});
    }
    sync();
  };

  const onLoadedData = () => {
    if (still) ready = true;
    sync();
  };

  const onProgress = () => window.clearTimeout(stallTimer);
  const onError = () => fail(`media error ${video.error?.code ?? '?'}`);
  const onVisible = () => sync();

  const events: Array<[string, () => void]> = [
    ['loadedmetadata', sync],
    ['loadeddata', onLoadedData],
    ['playing', onPlaying],
    ['seeked', onSeeked],
    ['timeupdate', onProgress],
    ['waiting', armStall],
    ['stalled', armStall],
    ['error', onError],
  ];
  for (const [name, handler] of events) video.addEventListener(name, handler);
  document.addEventListener('visibilitychange', onVisible);
  const ticker = window.setInterval(sync, SYNC_EVERY_MS);
  const offSeek = onSeek?.(sync);

  slot.style.transition = 'none';
  slot.style.opacity = '0';
  video.loop = picked.loop;
  videoSource(picked.url)
    .then((src) => {
      if (stopped) return;
      video.src = src;
      video.load();
    })
    .catch((err) => fail(String(err)));

  function stop() {
    stopped = true;
    for (const [name, handler] of events) video.removeEventListener(name, handler);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(ticker);
    window.clearTimeout(stallTimer);
    window.clearTimeout(opaqueTimer);
    offSeek?.();
    video.pause();
    video.removeAttribute('src');
    video.load();
    slot.style.transition = 'none';
    slot.style.opacity = '0';
    setVideoOpaque(host, false);
  }

  return () => {
    if (!stopped) stop();
  };
}
