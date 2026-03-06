import type { Howl } from 'howler';

interface ProgressState {
  isPlaying: boolean;
  seekRequest: number | null;
}

interface ProgressLoopOptions {
  getHowl: () => Howl | null;
  getState: () => ProgressState;
  onProgress: (seconds: number) => void;
}

export function createProgressLoop(options: ProgressLoopOptions) {
  const { getHowl, getState, onProgress } = options;

  let rafId: number | null = null;

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function tick() {
    const howl = getHowl();
    const state = getState();

    if (!howl || !state.isPlaying) {
      rafId = null;
      return;
    }

    if (howl.playing()) {
      const seek = howl.seek();
      if (typeof seek === 'number' && state.seekRequest === null) {
        onProgress(seek);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(tick);
  }

  return { start, stop };
}
