import { describe, expect, it } from 'vitest';
import type { Track } from '../stores/player';
import {
  aggregateRelatedCandidates,
  buildDiscoverGenreGroups,
  rankDiscoverCandidates,
  rotateDiscoverRanking,
  selectDiscoverSeeds,
} from './discover-recommendations';

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

describe('Discover recommendations', () => {
  it('selects deterministic recent and liked seeds across artists and genres', () => {
    const recent = [track(90, 'recent-a', 'ambient'), track(91, 'recent-a', 'ambient')];
    const liked = [
      track(1, 'same', 'electronic'),
      track(2, 'same', 'electronic'),
      track(3, 'other', 'rock'),
      track(4, 'third', 'jazz'),
      track(5, 'fourth', 'folk'),
    ];

    const first = selectDiscoverSeeds(liked, recent, { limit: 6 });
    const second = selectDiscoverSeeds(liked, recent, { limit: 6 });

    expect(first.map((item) => item.urn)).toEqual(second.map((item) => item.urn));
    expect(first.slice(0, 2).map((item) => item.id)).toEqual([90, 91]);
    expect(new Set(first.map((item) => item.user.urn)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(first.map((item) => item.genre)).size).toBeGreaterThanOrEqual(5);
  });

  it('uses reciprocal rank instead of treating rank one and rank twenty equally', () => {
    const top = track(1, 'top');
    const repeatedLow = track(2, 'low');
    const padding = Array.from({ length: 9 }, (_, index) => track(100 + index, `p-${index}`));
    const candidates = aggregateRelatedCandidates([
      [top, ...padding, repeatedLow],
      [...padding, repeatedLow],
    ]);

    const ranked = rankDiscoverCandidates(candidates, { limit: 100 });
    expect(ranked.indexOf(top)).toBeLessThan(ranked.indexOf(repeatedLow));
  });

  it('filters recent, disliked and unplayable tracks and diversifies artists', () => {
    const sameOne = track(1, 'same');
    const sameTwo = track(2, 'same');
    const other = track(3, 'other');
    const recent = track(4, 'recent');
    const disliked = track(5, 'blocked');
    const unplayable = track(6, 'nope', 'rock', { access: 'blocked' });
    const candidates = aggregateRelatedCandidates([
      [sameOne, sameTwo, recent, disliked, unplayable, other],
    ]);

    const ranked = rankDiscoverCandidates(candidates, {
      excludedUrns: new Set([recent.urn]),
      blockedUrns: new Set([disliked.urn]),
      mode: 'diverse',
    });

    expect(ranked.map((item) => item.id)).toEqual([1, 3, 2]);
  });

  it('admits evidence-backed adjacent genres that are absent from likes', () => {
    const ranked = [
      track(1, 'a', 'ambient'),
      track(2, 'b', 'ambient'),
      track(3, 'c', 'shoegaze'),
      track(4, 'd', 'shoegaze'),
    ];
    const groups = buildDiscoverGenreGroups(ranked, [track(90, 'liked', 'ambient')]);

    expect(groups.map((group) => group.genre)).toEqual(['ambient', 'shoegaze']);
  });

  it('keeps the strongest prefix while rotating only the ranked tail', () => {
    const tracks = Array.from({ length: 12 }, (_, index) => track(index + 1, `a-${index}`));
    const first = rotateDiscoverRanking(tracks, 1, 8, 4);
    const second = rotateDiscoverRanking(tracks, 2, 8, 4);

    expect(first.slice(0, 4)).toEqual(tracks.slice(0, 4));
    expect(second.slice(0, 4)).toEqual(tracks.slice(0, 4));
    expect(first.slice(4).map((item) => item.id)).not.toEqual(
      second.slice(4).map((item) => item.id),
    );
  });
});
