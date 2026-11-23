import { markVideoFailed, videoSource } from './video-cache';
import { setVideoOpaque, type VideoHost } from './video-element';
import { beginVideoLoad } from './video-load';
import type { PickedVideo } from './video-pick';
import {
  clockTime,
  DRIFT_HOLD_SEC,
  LEAD_MIN_SEC,
  leadFor,
  type PlaybackClock,
  parkStep,
  SYNC_EVERY_MS,
  syncStep,
  videoTarget,
} from './video-sync';

export const FADE_MS = 300;

const STALL_MS = 30_000;
const HOLD_FRAME_MS = 700;
const END_HOLD_MS = 1_500;
const FAR_SEC = 10;
const MOVED_SEC = 0.1;
const START_PATIENCE_MS = 4_000;
const HOP_SEC = 3;
const LAG_MAX_SEC = 0.6;
const EARLY_SEC = 1;
const HAVE_METADATA = 1;
const HAVE_CURRENT_DATA = 2;
const HAVE_FUTURE_DATA = 3;
const HAVE_ENOUGH_DATA = 4;

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
  const startedAt = performance.now();
  let stopped = false;
  let shown = false;
  let ready = false;
  let wantPlay = false;
  let aim: number | null = null;
  let parkedAt = 0;
  let coldLead = LEAD_MIN_SEC;
  let startLag = 0;
  let playedAt = 0;
  let playedFrom = 0;
  let endedAt = 0;
  let nudging = false;
  let stallTimer = 0;
  let holdTimer = 0;
  let parkTimer = 0;
  let opaqueTimer = 0;
  let endLoad: (() => void) | null = null;

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
    if (!video.paused) return;
    rollFrom(video.currentTime);
    void video.play().catch(() => {});
  };

  const rollFrom = (time: number) => {
    playedAt = performance.now();
    playedFrom = time;
  };

  const rolls = () => video.currentTime - playedFrom >= MOVED_SEC;

  const pause = () => {
    wantPlay = false;
    aim = null;
    clearWait();
    if (!video.paused) video.pause();
  };

  const seekTo = (time: number) => {
    if (Math.abs(video.currentTime - time) > DRIFT_HOLD_SEC) video.currentTime = time;
  };

  const canPlay = () => !video.seeking && video.readyState >= HAVE_FUTURE_DATA;
  const canStart = () => !video.seeking && video.readyState >= HAVE_ENOUGH_DATA;

  const park = (target: number, rate: number, lead: number) => {
    aim = target + (lead + startLag) * rate;
    parkedAt = performance.now();
    wantPlay = true;
    if (!video.paused) video.pause();
    video.currentTime = aim;
    armHold();
  };

  const unpark = (target: number, rate: number, from: number) => {
    window.clearTimeout(parkTimer);
    const step = parkStep(target + startLag * rate, from, canStart());
    if (step === 'play') {
      aim = null;
      play();
    } else if (step === 'again') {
      const took = (performance.now() - parkedAt) / 1000;
      park(target, rate, leadFor(canStart() ? (target - from) / 2 : took));
    } else if (from - target > EARLY_SEC && canStart() && buffered(video, target)) {
      park(target, rate, LEAD_MIN_SEC);
    } else if (target < from) {
      parkTimer = window.setTimeout(sync, ((from - target) / rate - startLag) * 1000);
    }
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
      ready ||= !video.paused && canPlay();
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
    video.playbackRate = aim === null ? step.rate : now.rate;
    if (aim !== null && Math.abs(aim - target) < FAR_SEC) unpark(target, now.rate, aim);
    else if (aim !== null) park(target, now.rate, leadOf(target));
    else if (step.kind === 'jump') rejoin(target, now.rate);
    else inStep();
    want(true);
  };

  const rejoin = (target: number, rate: number) => {
    const behind = (target - video.currentTime) / rate;
    if (video.paused || behind < 0) return park(target, rate, leadOf(target));
    const sincePlay = performance.now() - playedAt;
    if (!rolls() && sincePlay < START_PATIENCE_MS) return;
    if (rolls() && sincePlay < START_PATIENCE_MS) startLag = Math.min(behind, LAG_MAX_SEC);
    const ahead = target + (LEAD_MIN_SEC + startLag) * rate;
    if (behind > HOP_SEC || !buffered(video, ahead)) return park(target, rate, leadOf(target));
    rollFrom(ahead);
    video.currentTime = ahead;
  };

  const inStep = () => {
    play();
    if (!rolls() || !canPlay()) return;
    ready = true;
    clearWait();
  };

  const leadOf = (target: number) => (buffered(video, target) ? LEAD_MIN_SEC : coldLead);

  const fail = (reason: string) => {
    if (stopped) return;
    stop();
    markVideoFailed(urn, picked.kind, reason);
  };

  const armStall = () => {
    window.clearTimeout(stallTimer);
    stallTimer = wantPlay ? window.setTimeout(() => fail('stalled'), STALL_MS) : 0;
  };

  const armHold = () => {
    armStall();
    window.clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => {
      ready = false;
      sync();
    }, HOLD_FRAME_MS);
  };

  const clearWait = () => {
    window.clearTimeout(stallTimer);
    window.clearTimeout(holdTimer);
    window.clearTimeout(parkTimer);
    stallTimer = 0;
  };

  const onMetadata = () => {
    coldLead = leadFor((performance.now() - startedAt) / 1000);
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
    if (!ready) sync();
    else if (!video.paused && canPlay()) clearWait();
  };

  const onError = () => fail(`media error ${video.error?.code ?? '?'}`);
  const onVisible = () => sync();

  const events: Array<[string, () => void]> = [
    ['loadedmetadata', onMetadata],
    ['loadeddata', onLoadedData],
    ['canplay', sync],
    ['canplaythrough', sync],
    ['playing', sync],
    ['seeked', sync],
    ['timeupdate', onTime],
    ['progress', onBytes],
    ['waiting', armHold],
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

function buffered(video: HTMLVideoElement, time: number): boolean {
  const ranges = video.buffered;
  for (let i = 0; i < ranges.length; i++) {
    if (ranges.start(i) <= time && time < ranges.end(i)) return true;
  }
  return false;
}
