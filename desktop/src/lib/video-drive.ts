import { markVideoFailed, videoSource } from './video-cache';
import { setVideoOpaque, type VideoHost } from './video-element';
import { beginVideoLoad } from './video-load';
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

const STALL_MS = 30_000;
const HOLD_FRAME_MS = 700;
const SEEK_PATIENCE_SEC = 5;
const END_HOLD_MS = 1_500;
const HAVE_METADATA = 1;
const HAVE_CURRENT_DATA = 2;
const HAVE_FUTURE_DATA = 3;

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
  let holdTimer = 0;
  let endLoad: (() => void) | null = null;
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

  const want = (wanted: boolean) => {
    show(wanted && ready);
    if (wanted && !ready) {
      endLoad ??= beginVideoLoad(host);
      return;
    }
    endLoad?.();
    endLoad = null;
  };

  const play = () => {
    wantPlay = true;
    if (video.paused) void video.play().catch(() => {});
  };

  const pause = () => {
    wantPlay = false;
    playAfterSeek = false;
    clearWait();
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
      return want(true);
    }
    const now = clock();
    if (picked.loop) {
      video.playbackRate = 1;
      if (now.playing) play();
      else pause();
      return want(true);
    }
    const target = videoTarget(clockTime(now, performance.now()), picked.offsetMs);
    const step = syncStep(target, video.currentTime, video.duration, now.rate, nudging);
    nudging = step.kind === 'nudge';
    if (step.kind === 'wait') {
      pause();
      seekTo(0);
      return want(false);
    }
    if (step.kind === 'end') {
      pause();
      endedAt ||= performance.now();
      return want(ready && performance.now() - endedAt < END_HOLD_MS);
    }
    endedAt = 0;
    if (!now.playing) {
      pause();
      seekTo(target);
      ready ||= !video.seeking && video.readyState >= HAVE_CURRENT_DATA;
      return want(true);
    }
    video.playbackRate = step.rate;
    const drift = Math.abs(video.currentTime - target);
    const onTheWay = video.seeking && drift < SEEK_PATIENCE_SEC;
    if (video.paused && drift <= DRIFT_HOLD_SEC) {
      play();
    } else if (video.paused && !onTheWay) {
      playAfterSeek = true;
      wantPlay = true;
      video.currentTime = target;
    } else if (step.kind === 'jump' && !onTheWay) {
      video.currentTime = step.time;
    }
    want(true);
  };

  const fail = (reason: string) => {
    if (stopped) return;
    stop();
    markVideoFailed(urn, picked.kind, reason);
  };

  const armStall = () => {
    window.clearTimeout(stallTimer);
    stallTimer = wantPlay ? window.setTimeout(() => fail('stalled'), STALL_MS) : 0;
  };

  const clearWait = () => {
    window.clearTimeout(stallTimer);
    window.clearTimeout(holdTimer);
    stallTimer = 0;
  };

  const onWaiting = () => {
    armStall();
    window.clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => {
      ready = false;
      sync();
    }, HOLD_FRAME_MS);
  };

  const onPlaying = () => {
    clearWait();
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

  const onBytes = () => {
    if (stallTimer) armStall();
  };

  const onTime = () => {
    if (!video.seeking && video.readyState >= HAVE_FUTURE_DATA) clearWait();
  };

  const onError = () => fail(`media error ${video.error?.code ?? '?'}`);
  const onVisible = () => sync();

  const events: Array<[string, () => void]> = [
    ['loadedmetadata', sync],
    ['loadeddata', onLoadedData],
    ['playing', onPlaying],
    ['seeked', onSeeked],
    ['timeupdate', onTime],
    ['progress', onBytes],
    ['waiting', onWaiting],
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
  endLoad = beginVideoLoad(host);
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
    clearWait();
    window.clearTimeout(opaqueTimer);
    offSeek?.();
    endLoad?.();
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
