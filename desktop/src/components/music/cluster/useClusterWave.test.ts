import { describe, expect, it } from 'vitest';
import type { ClusterId, ClusterResponseDto } from './types';
import {
  createClusterHydrationPlan,
  MAX_HYDRATED_TRACKS,
  MAX_TRACKS_PER_CLUSTER,
} from './useClusterWave';

const CLUSTERS: ClusterId[] = [
  'wave',
  'for_you',
  'top_artists',
  'fresh_drops',
  'same_vibe',
  'adjacent',
  'deep_cuts',
];

describe('createClusterHydrationPlan', () => {
  it('caps hydration and selects fairly across clusters', () => {
    const dto: ClusterResponseDto = {
      clusters: CLUSTERS.map((id) => ({
        id,
        track_ids: Array.from({ length: 12 }, (_, rank) => `${id}-${rank}`),
      })),
    };

    const plan = createClusterHydrationPlan(dto);

    expect(plan.ids).toHaveLength(MAX_HYDRATED_TRACKS);
    expect(new Set(plan.ids).size).toBe(MAX_HYDRATED_TRACKS);
    expect(plan.ids.slice(0, CLUSTERS.length)).toEqual(CLUSTERS.map((id) => `${id}-0`));
    expect(
      plan.ids.every((id) => {
        const parts = id.split('-');
        return Number(parts[parts.length - 1]) < MAX_TRACKS_PER_CLUSTER;
      }),
    ).toBe(true);
  });

  it('retains full consensus and optional scores for every selected ID', () => {
    const dto: ClusterResponseDto = {
      clusters: [
        {
          id: 'wave',
          track_ids: ['shared', 'wave-only'],
          scores: { shared: 0.73 },
        },
        {
          id: 'same_vibe',
          track_ids: [
            ...Array.from({ length: 11 }, (_, rank) => `vibe-${rank}`),
            { track_id: 'shared', score: 0.41 },
          ],
        },
      ],
    };

    const plan = createClusterHydrationPlan(dto);
    const shared = plan.sourcesByTrackId.get('shared');

    expect(plan.ids).toContain('shared');
    expect(shared).toEqual([
      { clusterId: 'wave', rank: 0, score: 0.73 },
      { clusterId: 'same_vibe', rank: 11, score: 0.41 },
    ]);
  });

  it('ignores unknown clusters and respects zero budgets', () => {
    const dto: ClusterResponseDto = {
      clusters: [
        { id: 'unknown-future-cluster', track_ids: ['bad'] },
        { id: 'wave', track_ids: ['good'] },
      ],
    };

    expect(createClusterHydrationPlan(dto, 10, 1).ids).toEqual(['good']);
    expect(createClusterHydrationPlan(dto, 10, 0).ids).toEqual([]);
    expect(createClusterHydrationPlan(dto, 0, 60).ids).toEqual([]);
  });
});
