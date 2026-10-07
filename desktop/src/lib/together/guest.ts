import { toast } from 'sonner';
import i18n from '../../i18n';
import { setPlaybackDirector, usePlayerStore } from '../../stores/player';
import { type TogetherSync, useTogetherStore } from '../../stores/together';
import {
  alignTo,
  getCurrentTime,
  getDownloadProgress,
  getDuration,
  isTrackLoaded,
  replayCurrent,
  setStartGate,
} from '../audio';
import { roomsApi } from './api';
import { positionAt } from './clock';
import { acceptTimed, type RoomRole, serverTime, sleep, waitForRoom } from './link';
import type { RoomView } from './types';

const DRIFT_TOLERANCE_SEC = 0.35;
const ALIGN_COOLDOWN_MS = 2_500;
const DRIFT_CHECK_MS = 1_000;
const GATE_TIMEOUT_MS = 15_000;
const NOTICE_COOLDOWN_MS = 3_000;

function playback() {
  return useTogetherStore.getState().room?.playback ?? null;
}

function hostName(): string {
  const room = useTogetherStore.getState().room;
  return room?.members.find((m) => m.userId === room.hostId)?.name ?? '';
}

function setSync(sync: TogetherSync): void {
  if (useTogetherStore.getState().sync !== sync) useTogetherStore.setState({ sync });
}

export function attachGuest(): RoomRole {
  let gating = false;
  let lastSignature = '';
  let lastAlign = 0;
  let lastNotice = 0;
  const savedRate = usePlayerStore.getState().playbackRate;

  function noticeHostLeads(): void {
    const now = Date.now();
    if (now - lastNotice < NOTICE_COOLDOWN_MS) return;
    lastNotice = now;
    toast(i18n.t('together.toast.hostLeads', { name: hostName() }), {
      description: i18n.t('together.toast.hostLeadsHint'),
    });
  }

  function checkDrift(force = false): void {
    const pb = playback();
    const player = usePlayerStore.getState();
    if (
      gating ||
      !pb ||
      pb.status !== 'playing' ||
      !player.isPlaying ||
      !isTrackLoaded() ||
      player.currentTrack?.urn !== pb.trackUrn
    ) {
      return;
    }
    const expected = positionAt(pb, serverTime()) / 1000;
    if (expected < 0 || expected > getDuration()) return;
    const off = Math.abs(getCurrentTime() - expected) > DRIFT_TOLERANCE_SEC;
    setSync(off ? 'catching-up' : 'synced');
    if (!off || (!force && Date.now() - lastAlign < ALIGN_COOLDOWN_MS)) return;
    lastAlign = Date.now();
    alignTo(expected);
  }

  function follow(view: RoomView): void {
    const pb = view.playback;
    const signature = `${pb.trackUrn}|${pb.status}|${pb.positionMs}|${pb.at}|${pb.rate}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    if (pb.status === 'idle' || !pb.track || !pb.trackUrn) return;
    const player = usePlayerStore.getState();
    if (Math.abs(player.playbackRate - pb.rate) > 0.001) player.setPlaybackRate(pb.rate);
    const playing = pb.status !== 'paused';
    if (player.currentTrack?.urn !== pb.trackUrn) {
      setSync('catching-up');
      usePlayerStore.setState({
        currentTrack: pb.track,
        queue: [pb.track],
        queueIndex: 0,
        originalQueue: null,
        isPlaying: playing,
      });
      return;
    }
    if (player.isPlaying !== playing) {
      usePlayerStore.setState({ isPlaying: playing });
    } else if (playing && !isTrackLoaded() && !gating && getDownloadProgress() == null) {
      replayCurrent();
    }
    if (!playing && isTrackLoaded()) alignTo(pb.positionMs / 1000);
    checkDrift(true);
  }

  async function gate(urn: string): Promise<number | null> {
    gating = true;
    try {
      const code = useTogetherStore.getState().room?.code;
      if (code) {
        void roomsApi
          .ready(code, urn)
          .then((timed) => acceptTimed(timed))
          .catch(() => {});
      }
      await waitForRoom(() => {
        const pb = playback();
        return !pb || pb.trackUrn !== urn || pb.status !== 'loading';
      }, GATE_TIMEOUT_MS);
    } finally {
      gating = false;
    }
    const pb = playback();
    if (!pb || pb.trackUrn !== urn) return null;
    if (pb.status !== 'playing') return pb.positionMs / 1000;
    const position = positionAt(pb, serverTime());
    if (position < 0) {
      await sleep(-position / pb.rate);
      setSync('synced');
      return 0;
    }
    return position / 1000;
  }

  usePlayerStore.getState().clearAbLoop();
  setPlaybackDirector((action) => {
    if (action !== 'advance') noticeHostLeads();
    return false;
  });
  setStartGate(gate);
  const timer = setInterval(() => checkDrift(), DRIFT_CHECK_MS);

  return {
    onView: follow,
    detach: () => {
      clearInterval(timer);
      setPlaybackDirector(null);
      setStartGate(null);
      usePlayerStore.getState().setPlaybackRate(savedRate);
      setSync('synced');
    },
  };
}
