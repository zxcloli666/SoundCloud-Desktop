import { type Track, usePlayerStore } from '../../stores/player';
import { getCurrentTime, getDuration, playAt, seek } from '../audio';
import { setTrackLiked } from '../like-toggle';
import { isUrnLiked } from '../likes';
import { isLocalUrn } from '../local-library';
import { queryClient } from '../query-client';
import { armLikesContinuation } from '../queue-continuation';
import {
  type EntityQueue,
  entityQueue,
  likesQueue,
  similarQueue,
  waveQueue,
} from './entity-tracks';
import type { PlayerPort } from './execute';
import type { PlayerShot, Scope } from './undo';

const UNMUTE_FALLBACK = 60;

function likedNow(track: Track | null): boolean {
  return !!track && (isUrnLiked(track.urn) || !!track.user_favorite);
}

function shot(): PlayerShot {
  const s = usePlayerStore.getState();
  return {
    track: s.currentTrack,
    queue: s.queue,
    queueIndex: s.queueIndex,
    originalQueue: s.originalQueue,
    position: getCurrentTime(),
    playing: s.isPlaying,
    volume: s.volume,
    shuffle: s.shuffle,
    repeat: s.repeat,
    liked: likedNow(s.currentTrack),
  };
}

function indexIn(queue: Track[], urn: string | undefined, fallback: number): number {
  const at = urn ? queue.findIndex((t) => t.urn === urn) : -1;
  return at >= 0 ? at : fallback;
}

async function restore(before: PlayerShot, scope: Scope[]): Promise<void> {
  const store = usePlayerStore;
  const current = store.getState().currentTrack;
  for (const part of scope) {
    if (part === 'track') {
      if (!before.track) {
        store.getState().pause();
        continue;
      }
      playAt(before.track, before.position);
      store.setState({
        queue: before.queue,
        queueIndex: before.queueIndex,
        originalQueue: before.originalQueue,
      });
      if (!before.playing) store.getState().pause();
    }
    if (part === 'playing') {
      if (before.playing) store.getState().resume();
      else store.getState().pause();
    }
    if (part === 'position') seek(before.position);
    if (part === 'volume') store.getState().setVolume(before.volume);
    if (part === 'like' && before.track)
      await setTrackLiked(queryClient, before.track, before.liked);
    if (part === 'repeat') store.setState({ repeat: before.repeat });
    if (part === 'shuffle' || part === 'queue') {
      store.setState({
        shuffle: before.shuffle,
        queue: before.queue,
        originalQueue: before.originalQueue,
        queueIndex: indexIn(before.queue, current?.urn, before.queueIndex),
      });
    }
  }
}

function start(queue: EntityQueue): boolean {
  const first = queue.tracks[0];
  if (!first) return false;
  usePlayerStore.getState().play(first, queue.tracks);
  queue.arm?.();
  return true;
}

export const playerPort: PlayerPort = {
  shot,
  restore,
  playEntity: async (entity) => start(await entityQueue(entity)),
  queueEntity: async (entity) => {
    const queue = await entityQueue(entity);
    if (queue.tracks.length === 0) return false;
    if (!usePlayerStore.getState().currentTrack) return start(queue);
    usePlayerStore.getState().addToQueueNext(queue.tracks);
    return true;
  },
  playLikes: async () => {
    const ok = start(await likesQueue());
    if (ok) await armLikesContinuation();
    return ok;
  },
  playWave: async () => start(await waveQueue()),
  playSimilar: async () => start(await similarQueue()),
  pause: () => usePlayerStore.getState().pause(),
  resume: () => usePlayerStore.getState().resume(),
  next: () => usePlayerStore.getState().next(),
  previous: () => usePlayerStore.getState().prev(),
  seekTo: (seconds) => {
    const end = getDuration();
    seek(Math.max(0, end > 0 ? Math.min(seconds, end - 1) : seconds));
  },
  setVolume: (volume) => usePlayerStore.getState().setVolume(volume),
  unmute: () => {
    const s = usePlayerStore.getState();
    if (s.volume === 0) s.setVolume(s.volumeBeforeMute || UNMUTE_FALLBACK);
  },
  setLiked: async (liked) => {
    const track = usePlayerStore.getState().currentTrack;
    if (!track || isLocalUrn(track.urn)) return false;
    if (likedNow(track) !== liked) await setTrackLiked(queryClient, track, liked);
    return true;
  },
  setShuffle: (on) => {
    const s = usePlayerStore.getState();
    if (s.shuffle !== on) s.toggleShuffle();
  },
  setRepeat: (mode) => usePlayerStore.setState({ repeat: mode }),
};
