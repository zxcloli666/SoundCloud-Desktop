import type { Track } from '../../../stores/player';

export const TRACK_MARK = 'data-voice-track';

export interface ScreenTrack {
  track(): Track;
  start(): void;
}

const mounted = new Map<string, ScreenTrack>();

export function mountTrack(id: string, entry: ScreenTrack): () => void {
  mounted.set(id, entry);
  return () => {
    if (mounted.get(id) === entry) mounted.delete(id);
  };
}

export function screenTrack(id: string): ScreenTrack | undefined {
  return mounted.get(id);
}
