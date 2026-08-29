import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  getItem: vi.fn(async () => null),
  removeItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('../lib/tauri-storage', () => ({
  createThrottledJsonStorage: () => storage,
}));

import { getPlayerQueueRevision, type Track, usePlayerStore } from './player';

function track(id: number): Track {
  return {
    id,
    urn: `soundcloud:tracks:${id}`,
    title: `Track ${id}`,
    duration: 180_000,
    artwork_url: null,
    user: {
      id,
      urn: `soundcloud:users:${id}`,
      username: `Artist ${id}`,
      avatar_url: '',
    },
  };
}

function resetPlayer(): void {
  usePlayerStore.setState({
    currentTrack: null,
    queue: [],
    originalQueue: null,
    queueIndex: -1,
    isPlaying: false,
    volume: 50,
    volumeBeforeMute: 50,
    shuffle: false,
    repeat: 'off',
    abLoop: null,
    playbackQuality: null,
    playbackSource: null,
    playbackRate: 1,
    pitchSemitones: 0,
    pitchControlMode: 'auto',
  });
}

describe('player store hot paths', () => {
  beforeAll(async () => {
    await usePlayerStore.persist.rehydrate();
  });

  beforeEach(() => {
    resetPlayer();
    storage.setItem.mockClear();
  });

  it('appends and advances the queue in one state update', () => {
    const first = track(1);
    const second = track(2);
    usePlayerStore.setState({
      currentTrack: first,
      queue: [first],
      queueIndex: 0,
      isPlaying: false,
    });
    storage.setItem.mockClear();
    const listener = vi.fn();
    const unsubscribe = usePlayerStore.subscribe(listener);
    const previousRevision = getPlayerQueueRevision();

    usePlayerStore.getState().appendToQueueAndPlayNext([second]);

    const state = usePlayerStore.getState();
    expect(state.queue).toEqual([first, second]);
    expect(state.currentTrack).toBe(second);
    expect(state.queueIndex).toBe(1);
    expect(state.isPlaying).toBe(true);
    expect(getPlayerQueueRevision()).toBe(previousRevision + 1);
    expect(listener).toHaveBeenCalledOnce();
    expect(storage.setItem).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('does not persist non-persisted transport state or repeat no-op actions', () => {
    usePlayerStore.setState({ isPlaying: true });
    storage.setItem.mockClear();
    const listener = vi.fn();
    const unsubscribe = usePlayerStore.subscribe(listener);

    usePlayerStore.getState().pause();
    usePlayerStore.getState().pause();
    usePlayerStore.getState().setPlaybackTransport('hq', 'api');
    usePlayerStore.getState().setPlaybackTransport('hq', 'api');
    usePlayerStore.getState().setVolume(50.4);
    usePlayerStore.getState().addToQueue([]);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(storage.setItem).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('keeps queue references stable when metadata is unchanged', () => {
    const current = track(1);
    const queue = [current];
    usePlayerStore.setState({ currentTrack: current, queue, queueIndex: 0 });
    storage.setItem.mockClear();
    const listener = vi.fn();
    const unsubscribe = usePlayerStore.subscribe(listener);
    const previousRevision = getPlayerQueueRevision();

    usePlayerStore.getState().replaceTrackMetadata({ ...current });

    expect(usePlayerStore.getState().queue).toBe(queue);
    expect(usePlayerStore.getState().currentTrack).toBe(current);
    expect(getPlayerQueueRevision()).toBe(previousRevision);
    expect(listener).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    unsubscribe();
  });
});
