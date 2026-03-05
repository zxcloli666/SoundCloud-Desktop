import { type Track, usePlayerStore } from '../../stores/player.ts';
import { useShallow } from 'zustand/shallow';
import { useCallback, useMemo } from 'react';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useQueuePlayback(tracks: Track[]) {
  const { play, pause, resume, currentTrack, isPlaying } = usePlayerStore(
    useShallow((s) => ({
      play: s.play,
      pause: s.pause,
      resume: s.resume,
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
    })),
  );

  const isCurrentInQueue = useMemo(() => {
    const urn = currentTrack?.urn;
    return !!urn && tracks.some((t) => t.urn === urn);
  }, [tracks, currentTrack?.urn]);

  const isQueuePlaying = isCurrentInQueue && isPlaying;

  const playAll = useCallback(() => {
    if (tracks.length === 0) return;
    if (isQueuePlaying) pause();
    else if (isCurrentInQueue) resume();
    else play(tracks[0], tracks);
  }, [tracks, isQueuePlaying, isCurrentInQueue, pause, resume, play]);

  const shufflePlay = useCallback(() => {
    if (tracks.length === 0) return;
    const shuffled = shuffleArray(tracks);
    play(shuffled[0], shuffled);
  }, [tracks, play]);

  return { isQueuePlaying, playAll, shufflePlay };
}
