export type TrayRepeatMode = 'off' | 'one' | 'all';

export interface TrayNowPlayingSnapshot {
  hasTrack: boolean;
  title: string;
  artist: string;
  artworkUrl: string | null;
  artworkLarge: string | null;
  isPlaying: boolean;
  volume: number;
  liked: boolean;
  disliked: boolean;
  shuffle: boolean;
  repeat: TrayRepeatMode;
  durationSec: number;
  abLoop: { a: number; b: number | null } | null;
}

export function areTraySnapshotsEqual(
  a: TrayNowPlayingSnapshot,
  b: TrayNowPlayingSnapshot,
): boolean {
  const sameAbLoop =
    a.abLoop === b.abLoop ||
    (a.abLoop !== null &&
      b.abLoop !== null &&
      a.abLoop.a === b.abLoop.a &&
      a.abLoop.b === b.abLoop.b);
  return (
    a.hasTrack === b.hasTrack &&
    a.title === b.title &&
    a.artist === b.artist &&
    a.artworkUrl === b.artworkUrl &&
    a.artworkLarge === b.artworkLarge &&
    a.isPlaying === b.isPlaying &&
    a.volume === b.volume &&
    a.liked === b.liked &&
    a.disliked === b.disliked &&
    a.shuffle === b.shuffle &&
    a.repeat === b.repeat &&
    a.durationSec === b.durationSec &&
    sameAbLoop
  );
}
