import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore, type Track } from '../../stores/player';

export function useTrackPlayback(track: Track | null | undefined, queue: Track[] = []) {
  const { play, pause, resume, currentTrack, isPlaying } = usePlayerStore(
    useShallow((s) => ({
      play: s.play,
      pause: s.pause,
      resume: s.resume,
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
    })),
  );

  const trackUrn = track?.urn;
  const isCurrent = !!trackUrn && currentTrack?.urn === trackUrn;
  const isCurrentPlaying = isCurrent && isPlaying;

  const togglePlay = useCallback(
    (e?: { stopPropagation?: () => void }) => {
      e?.stopPropagation?.();
      if (isCurrent && isPlaying) pause();
      else if (isCurrent) resume();
      else if (track) play(track, queue);
    },
    [isCurrent, isPlaying, pause, resume, play, track, queue],
  );

  return { isCurrent, isCurrentPlaying, togglePlay };
}
