import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { type Track, usePlayerStore } from '../../stores/player';
import {
  hasScrobbleAccount,
  IDLE_LIVE,
  type ScrobblePhase,
  useScrobbleStore,
} from '../../stores/scrobble';
import { useSettingsStore } from '../../stores/settings';
import { getDuration } from '../audio';
import { isPreviewOnly } from '../track-access';
import { getArtistDisplay, getDisplayTitle } from '../track-display';
import { loadScrobbleStatus } from './client';
import { isLongEnough, isRestart, playedStep, scrobbleThreshold } from './rules';

const NOW_PLAYING_RESEND_MS = 60_000;

interface Session {
  urn: string;
  startedAt: number;
  played: number;
  lastPos: number;
  done: boolean;
  nowPlayingAt: number;
}

let session: Session | null = null;

function active(): boolean {
  return (
    useSettingsStore.getState().scrobbleEnabled &&
    hasScrobbleAccount(useScrobbleStore.getState().status)
  );
}

function durationOf(track: Track): number {
  const fromTrack = track.duration / 1000;
  return fromTrack > 0 ? fromTrack : getDuration();
}

function eligible(track: Track): boolean {
  return !isPreviewOnly(track) && isLongEnough(durationOf(track));
}

function payload(track: Track, timestamp: number) {
  return {
    artist: getArtistDisplay(track).primary || track.user?.username || '',
    title: getDisplayTitle(track),
    timestamp,
    duration_secs: Math.round(durationOf(track)) || null,
    url: track.permalink_url ? track.permalink_url.replace(/\?.*$/, '') : null,
  };
}

function phaseOf(track: Track, current: Session): ScrobblePhase {
  if (current.done) return 'scrobbled';
  if (isPreviewOnly(track)) return 'preview';
  return isLongEnough(durationOf(track)) ? 'listening' : 'short';
}

function publish(track: Track, current: Session) {
  const phase = phaseOf(track, current);
  const played = Math.floor(current.played);
  const threshold = Math.round(scrobbleThreshold(durationOf(track)));
  const { live } = useScrobbleStore.getState();
  if (
    live.urn === current.urn &&
    live.phase === phase &&
    live.played === played &&
    live.threshold === threshold
  ) {
    return;
  }
  useScrobbleStore.setState({ live: { urn: current.urn, phase, played, threshold } });
}

function sendNowPlaying(track: Track, current: Session) {
  if (!useSettingsStore.getState().scrobbleNowPlaying) return;
  current.nowPlayingAt = Date.now();
  void invoke('scrobble_now_playing', {
    track: payload(track, Math.floor(Date.now() / 1000)),
  }).catch(() => undefined);
}

function submit(track: Track, current: Session) {
  current.done = true;
  useScrobbleStore.setState((s) => ({ sent: s.sent + 1 }));
  void invoke('scrobble_submit', { track: payload(track, current.startedAt) }).catch((e) =>
    console.warn('[Scrobble] submit failed:', e),
  );
}

function begin(track: Track, pos: number): Session {
  return {
    urn: track.urn,
    startedAt: Math.floor(Date.now() / 1000 - pos),
    played: 0,
    lastPos: pos,
    done: false,
    nowPlayingAt: 0,
  };
}

function onTick(pos: number) {
  if (!active()) return;
  const { currentTrack: track, isPlaying } = usePlayerStore.getState();
  if (!track) return;

  if (!session || session.urn !== track.urn || (session.done && isRestart(session.lastPos, pos))) {
    session = begin(track, pos);
  }
  const current = session;
  if (isPlaying) current.played += playedStep(current.lastPos, pos);
  current.lastPos = pos;

  const canScrobble = eligible(track);
  if (isPlaying && canScrobble && !current.nowPlayingAt) sendNowPlaying(track, current);
  if (canScrobble && !current.done && current.played >= scrobbleThreshold(durationOf(track))) {
    submit(track, current);
  }
  publish(track, current);
}

usePlayerStore.subscribe((state, prev) => {
  if (!state.currentTrack) {
    session = null;
    useScrobbleStore.setState({ live: IDLE_LIVE });
    return;
  }
  const track = state.currentTrack;
  const resumed = state.isPlaying && !prev.isPlaying;
  const current = session;
  if (!resumed || !current || current.urn !== track.urn || current.done) return;
  if (!current.nowPlayingAt || !active() || !eligible(track)) return;
  if (Date.now() - current.nowPlayingAt < NOW_PLAYING_RESEND_MS) return;
  sendNowPlaying(track, current);
});

useSettingsStore.subscribe((state, prev) => {
  if (state.scrobbleEnabled === prev.scrobbleEnabled) return;
  session = null;
  useScrobbleStore.setState({ live: IDLE_LIVE });
});

void loadScrobbleStatus();
void listen<number>('audio:tick', (event) => onTick(event.payload));
