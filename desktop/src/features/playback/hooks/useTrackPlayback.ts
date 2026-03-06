import { useCallback } from 'react';
import type { Track } from '../../../api/types.ts';
import { usePlaybackControls } from './usePlaybackControls.ts';

export function useTrackPlayback(track: Track | null | undefined, queue: Track[] = []) {
  const { play, pause, resume, currentTrack, isPlaying } = usePlaybackControls();

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
