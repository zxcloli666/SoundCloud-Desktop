import { useShallow } from 'zustand/shallow';
import { usePlayerStore } from '../../../stores/player.ts';

export function usePlaybackControls() {
  return usePlayerStore(
    useShallow((s) => ({
      play: s.play,
      pause: s.pause,
      resume: s.resume,
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
    })),
  );
}
