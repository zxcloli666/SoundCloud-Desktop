import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Track } from '../stores/player';

const mocks = vi.hoisted(() => ({
  curate: vi.fn((tracks: readonly Track[]) => [...tracks]),
  disliked: new Set<string>(),
  liked: new Set<string>(),
}));

vi.mock('./dislikes', () => ({
  isUrnDisliked: (urn: string) => mocks.disliked.has(urn),
}));
vi.mock('./likes', () => ({
  isUrnLiked: (urn: string) => mocks.liked.has(urn),
}));
vi.mock('./local-recommendations', () => ({
  curateWithLocalTaste: mocks.curate,
}));

import { curateQueueRecommendations } from './queue-recommendations';

function track(id: number, patch: Partial<Track> = {}): Track {
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
    ...patch,
  };
}

const options = {
  hideLiked: true,
  hideListened: true,
  limit: 20,
  mode: 'similar' as const,
};

describe('curateQueueRecommendations', () => {
  beforeEach(() => {
    mocks.curate.mockClear();
    mocks.disliked.clear();
    mocks.liked.clear();
  });

  it('hard-filters queue items, dislikes, likes, unplayable tracks, and duplicate recordings', () => {
    const existing = track(1, { publisher_metadata: { isrc: 'AA-AAA-11-00001' } });
    const duplicateRecording = track(2, { publisher_metadata: { isrc: 'AAAAA1100001' } });
    const disliked = track(3);
    const liked = track(4);
    const favorite = track(5, { user_favorite: true });
    const blocked = track(6, { access: 'blocked' });
    const privateTrack = track(7, { sharing: 'private' });
    const invalidDuration = track(8, { duration: 0 });
    const firstRecording = track(9, { publisher_metadata: { isrc: 'BB-BBB-22-00002' } });
    const repeatedRecording = track(10, { publisher_metadata: { isrc: 'BBBBB2200002' } });
    const eligible = track(11);
    mocks.disliked.add(disliked.urn);
    mocks.liked.add(liked.urn);

    const result = curateQueueRecommendations(
      [
        existing,
        duplicateRecording,
        disliked,
        liked,
        favorite,
        blocked,
        privateTrack,
        invalidDuration,
        firstRecording,
        repeatedRecording,
        eligible,
      ],
      [existing],
      options,
    );

    expect(result.map((item) => item.id)).toEqual([9, 11]);
    expect(mocks.curate).toHaveBeenCalledWith(
      [firstRecording, eligible],
      expect.objectContaining({
        hideLiked: true,
        hideListened: true,
        limit: 20,
        mode: 'similar',
      }),
    );
  });

  it('keeps liked candidates when the setting is disabled', () => {
    const liked = track(20);
    mocks.liked.add(liked.urn);

    expect(
      curateQueueRecommendations([liked], [], { ...options, hideLiked: false }).map(
        (item) => item.urn,
      ),
    ).toEqual([liked.urn]);
  });
});
