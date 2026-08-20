import { describe, expect, it } from 'vitest';
import type { Track } from '../stores/player';
import { curateHomeRecommendations } from './home-recommendations';

function track(id: number, artist: string, genre = 'electronic'): Track {
  return {
    id,
    urn: `soundcloud:tracks:${id}`,
    title: `Track ${id}`,
    duration: 180_000,
    artwork_url: null,
    genre,
    user: {
      id,
      urn: `soundcloud:users:${artist}`,
      username: artist,
      avatar_url: '',
    },
  };
}

describe('curateHomeRecommendations', () => {
  it('removes duplicate and blocked tracks while preserving server order', () => {
    const one = track(1, 'a');
    const result = curateHomeRecommendations([one, one, track(2, 'b'), track(3, 'c')], {
      blockedUrns: new Set(['soundcloud:tracks:2']),
    });

    expect(result.map((item) => item.id)).toEqual([1, 3]);
  });

  it('keeps the first shelf diverse by artist', () => {
    const result = curateHomeRecommendations(
      [track(1, 'same'), track(2, 'same'), track(3, 'same'), track(4, 'other'), track(5, 'third')],
      { limit: 4 },
    );

    expect(result.map((item) => item.id)).toEqual([1, 2, 4, 5]);
  });

  it('uses listened tracks only after the fresh pool is exhausted', () => {
    const result = curateHomeRecommendations([track(1, 'a'), track(2, 'b'), track(3, 'c')], {
      excludedUrns: new Set(['soundcloud:tracks:1', 'soundcloud:tracks:2']),
      limit: 3,
    });

    expect(result.map((item) => item.id)).toEqual([3, 1, 2]);
  });
});
