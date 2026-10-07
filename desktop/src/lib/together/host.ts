import { usePlayerStore } from '../../stores/player';
import { useTogetherStore } from '../../stores/together';
import { getCurrentTime, isTrackLoaded, setStartGate, subscribeSeek } from '../audio';
import { roomsApi, type Timed } from './api';
import { positionAt } from './clock';
import {
  acceptTimed,
  oneWayMs,
  onlineGuests,
  type RoomRole,
  serverTime,
  sleep,
  waitForRoom,
} from './link';
import { roomTrack } from './track';
import type { PlaybackUpdate } from './types';

const BARRIER_TIMEOUT_MS = 8_000;
const START_LEAD_MS = 700;
const HEARTBEAT_MS = 15_000;
const HOST_DRIFT_MS = 600;

function currentUpdate(): PlaybackUpdate {
  const { currentTrack, isPlaying, playbackRate } = usePlayerStore.getState();
  if (!currentTrack) return { status: 'idle' };
  const loaded = isTrackLoaded();
  const status = !isPlaying ? 'paused' : loaded ? 'playing' : 'loading';
  const lag = status === 'playing' ? oneWayMs() : 0;
  return {
    status,
    track: roomTrack(currentTrack),
    trackUrn: currentTrack.urn,
    positionMs: Math.round(getCurrentTime() * 1000 + lag),
    rate: playbackRate,
  };
}

export function attachHost(): RoomRole {
  let pending: string | null = null;
  let disposed = false;
  let publishQueued = false;
  let chain: Promise<unknown> = Promise.resolve();

  function send(next: PlaybackUpdate | (() => PlaybackUpdate | null)): Promise<Timed | null> {
    const task = async (): Promise<Timed | null> => {
      const code = useTogetherStore.getState().room?.code;
      const update = typeof next === 'function' ? next() : next;
      if (!code || disposed || !update) return null;
      try {
        const timed = await roomsApi.playback(code, update);
        acceptTimed(timed);
        return timed;
      } catch {
        return null;
      }
    };
    const run = chain.then(task, task);
    chain = run;
    return run;
  }

  function publish(): void {
    if (pending || disposed || publishQueued) return;
    publishQueued = true;
    void send(() => {
      publishQueued = false;
      return pending ? null : currentUpdate();
    });
  }

  function unready(urn: string): number {
    return onlineGuests(useTogetherStore.getState().room).filter((m) => m.readyUrn !== urn).length;
  }

  async function gate(urn: string): Promise<number | null> {
    if (pending !== urn) {
      setTimeout(publish, 0);
      return null;
    }
    const guests = onlineGuests(useTogetherStore.getState().room).length;
    if (guests > 0 && usePlayerStore.getState().isPlaying) {
      useTogetherStore.setState({ waitingFor: unready(urn), sync: 'waiting' });
      const stopCounting = useTogetherStore.subscribe((state, prev) => {
        if (state.room !== prev.room) useTogetherStore.setState({ waitingFor: unready(urn) });
      });
      await waitForRoom(() => unready(urn) === 0 || pending !== urn, BARRIER_TIMEOUT_MS);
      stopCounting();
      useTogetherStore.setState({ waitingFor: 0, sync: 'synced' });
    }
    if (disposed || pending !== urn) return null;
    pending = null;
    const { currentTrack, isPlaying, playbackRate } = usePlayerStore.getState();
    if (!currentTrack || !isPlaying || guests === 0) {
      setTimeout(publish, 0);
      return null;
    }
    const timed = await send({
      status: 'playing',
      track: roomTrack(currentTrack),
      trackUrn: urn,
      positionMs: 0,
      leadMs: START_LEAD_MS,
      rate: playbackRate,
    });
    if (timed) {
      const wait = timed.view.playback.at - serverTime();
      if (wait > 0) await sleep(wait);
    }
    return null;
  }

  function heartbeat(): void {
    const room = useTogetherStore.getState().room;
    const { isPlaying, currentTrack } = usePlayerStore.getState();
    if (pending || !room || !isTrackLoaded()) return;
    const expected = currentUpdate();
    const playback = room.playback;
    if (playback.status !== expected.status || playback.trackUrn !== (currentTrack?.urn ?? null)) {
      publish();
      return;
    }
    if (!isPlaying) return;
    const drift = Math.abs(positionAt(playback, serverTime()) - getCurrentTime() * 1000);
    if (drift > HOST_DRIFT_MS) publish();
  }

  const stopPlayer = usePlayerStore.subscribe((state, prev) => {
    const urn = state.currentTrack?.urn ?? null;
    if (urn !== (prev.currentTrack?.urn ?? null)) {
      pending = urn;
      if (!state.currentTrack) {
        publish();
        return;
      }
      void send({
        status: 'loading',
        track: roomTrack(state.currentTrack),
        trackUrn: state.currentTrack.urn,
        positionMs: 0,
        rate: state.playbackRate,
      });
      return;
    }
    if (pending && !state.isPlaying && prev.isPlaying && !isTrackLoaded()) {
      pending = null;
    }
    if (state.isPlaying !== prev.isPlaying || state.playbackRate !== prev.playbackRate) {
      publish();
    }
  });
  const stopSeek = subscribeSeek(publish);
  const timer = setInterval(heartbeat, HEARTBEAT_MS);
  setStartGate(gate);
  publish();

  return {
    onView: () => {},
    detach: () => {
      disposed = true;
      stopPlayer();
      stopSeek();
      clearInterval(timer);
      setStartGate(null);
      useTogetherStore.setState({ waitingFor: 0, sync: 'synced' });
    },
  };
}
