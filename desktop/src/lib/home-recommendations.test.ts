import { describe, expect, it } from 'vitest';
import type { ClusterCandidate } from '../components/music/cluster/types';
import type { Track } from '../stores/player';
import { curateHomeRecommendations } from './home-recommendations';

function track(
  id: number,
  artist: string,
  genre = 'electronic',
  patch: Partial<Track> = {},
): Track {
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
    ...patch,
  };
}

function candidate(
  value: Track,
  sources: ClusterCandidate['sources'],
): ClusterCandidate {
  return { track: value, sources };
}

describe('curateHomeRecommendations', () => {
  it('removes duplicate and blocked tracks while preserving stable ties', () => {
    const one = track(1, 'a');
    const result = curateHomeRecommendations([one, one, track(2, 'b'), track(3, 'c')], {
      blockedUrns: new Set(['soundcloud:tracks:2']),
    });

    expect(result.map((item) => item.id)).toEqual([1, 3]);
  });

  it('uses MMR to keep the visible shelf diverse by artist', () => {
    const result = curateHomeRecommendations(
      [track(1, 'same'), track(2, 'same'), track(3, 'same'), track(4, 'other'), track(5, 'third')],
      { limit: 4 },
    );

    expect(result.map((item) => item.id)).toEqual([1, 4, 5, 2]);
  });

  it('keeps familiar tracks as a soft last-resort fallback', () => {
    const result = curateHomeRecommendations([track(1, 'a'), track(2, 'b'), track(3, 'c')], {
      excludedUrns: new Set(['soundcloud:tracks:1', 'soundcloud:tracks:2']),
      limit: 3,
    });

    expect(result.map((item) => item.id)).toEqual([3, 1, 2]);
  });

  it('guarantees deterministic refresh rotation even when every visible track was exposed', () => {
    const inputs = [track(1, 'a'), track(2, 'b'), track(3, 'c')];
    const exposureCounts = new Map(inputs.map((item) => [item.urn, 1]));
    const initial = curateHomeRecommendations(inputs, { exposureCounts, limit: 3 });
    const refreshed = curateHomeRecommendations(inputs, {
      exposureCounts,
      rotationEpoch: 1,
      limit: 3,
    });

    expect(initial.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(refreshed.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it('does not let exposure reranking cancel the visible refresh', () => {
    const result = curateHomeRecommendations([track(1, 'a'), track(2, 'b')], {
      exposureCounts: new Map([['soundcloud:tracks:1', 3]]),
      previousTopUrn: 'soundcloud:tracks:1',
      rotationEpoch: 1,
      limit: 2,
    });

    expect(result.map((item) => item.id)).toEqual([2, 1]);
  });

  it('boosts candidates that match liked and recent taste without selecting the seed itself', () => {
    const liked = track(90, 'favorite', 'ambient');
    const recent = track(91, 'favorite', 'ambient');
    const result = curateHomeRecommendations(
      [liked, track(1, 'unknown', 'rock'), track(2, 'favorite', 'ambient')],
      { likedTracks: [liked], recentTracks: [recent], limit: 2 },
    );

    expect(result.map((item) => item.id)).toEqual([2, 1]);
  });

  it('rewards consensus without flattening away cluster provenance', () => {
    const single = candidate(track(1, 'a'), [{ clusterId: 'for_you', rank: 0 }]);
    const consensus = candidate(track(2, 'b'), [
      { clusterId: 'for_you', rank: 0 },
      { clusterId: 'same_vibe', rank: 4 },
    ]);

    const result = curateHomeRecommendations([single, consensus], { limit: 2 });
    expect(result.map((item) => item.id)).toEqual([2, 1]);
  });

  it('hard-filters dislikes and tracks that cannot be played', () => {
    const blockedByUser = track(1, 'a');
    const blockedByPolicy = track(2, 'b', 'rock', { access: 'blocked' });
    const privateTrack = track(3, 'c', 'rock', { sharing: 'private' });
    const invalidDuration = track(4, 'd', 'rock', { duration: 0 });
    const playable = track(5, 'e');

    const result = curateHomeRecommendations(
      [blockedByUser, blockedByPolicy, privateTrack, invalidDuration, playable],
      { blockedUrns: new Set([blockedByUser.urn]) },
    );

    expect(result).toEqual([playable]);
  });

  it('makes diverse mode explore farther clusters and artists sooner', () => {
    const first = candidate(track(1, 'same'), [{ clusterId: 'for_you', rank: 0 }]);
    const second = candidate(track(2, 'same'), [{ clusterId: 'for_you', rank: 1 }]);
    const explorer = candidate(track(3, 'other', 'experimental'), [
      { clusterId: 'deep', rank: 9 },
    ]);

    const similar = curateHomeRecommendations([first, second, explorer], {
      mode: 'similar',
      limit: 2,
    });
    const diverse = curateHomeRecommendations([first, second, explorer], {
      mode: 'diverse',
      limit: 2,
    });

    expect(similar.map((item) => item.id)).toEqual([1, 2]);
    expect(diverse.map((item) => item.id)).toEqual([1, 3]);
  });

  it('is deterministic and does not mutate candidate provenance', () => {
    const input = [
      candidate(track(1, 'a'), [{ clusterId: 'wave', rank: 1, score: 0.7 }]),
      candidate(track(2, 'b'), [{ clusterId: 'adjacent', rank: 0, score: 0.4 }]),
    ];
    const before = JSON.stringify(input);
    const options = { mode: 'diverse' as const, now: Date.UTC(2026, 7, 26) };

    const first = curateHomeRecommendations(input, options);
    const second = curateHomeRecommendations(input, options);

    expect(second.map((item) => item.urn)).toEqual(first.map((item) => item.urn));
    expect(JSON.stringify(input)).toBe(before);
  });
});
