import { describe, expect, it } from 'vitest';
import { areTraySnapshotsEqual, type TrayNowPlayingSnapshot } from './tray-snapshot';

const BASE: TrayNowPlayingSnapshot = {
  hasTrack: true,
  title: 'Track',
  artist: 'Artist',
  artworkUrl: 'small.jpg',
  artworkLarge: 'large.jpg',
  isPlaying: true,
  volume: 75,
  liked: false,
  disliked: false,
  shuffle: false,
  repeat: 'off',
  durationSec: 180,
  abLoop: { a: 10, b: 20 },
};

describe('areTraySnapshotsEqual', () => {
  it('treats value-equivalent A-B loop objects as equal', () => {
    expect(
      areTraySnapshotsEqual(BASE, {
        ...BASE,
        abLoop: { a: 10, b: 20 },
      }),
    ).toBe(true);
  });

  it('detects a player-facing field change', () => {
    expect(areTraySnapshotsEqual(BASE, { ...BASE, volume: 76 })).toBe(false);
    expect(areTraySnapshotsEqual(BASE, { ...BASE, abLoop: { a: 10, b: null } })).toBe(false);
  });
});
