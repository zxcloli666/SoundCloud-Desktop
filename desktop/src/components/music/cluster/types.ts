import type { Track } from '../../../stores/player';

export type ClusterId =
  | 'wave'
  | 'essence'
  | 'vibe'
  | 'neighbors'
  | 'deep'
  | 'for_you'
  | 'top_artists'
  | 'adjacent'
  | 'fresh_drops'
  | 'same_vibe'
  | 'deep_cuts'
  | 'same_artist'
  | 'featured_with'
  | 'fans_also';

export interface ClusterNeighborDto {
  artist_id: string;
  artist_name: string;
  avatar_url?: string;
  track_id: string;
}

export interface ClusterTrackRefDto {
  id?: string | number;
  track_id?: string | number;
  score?: number;
}

export interface ClusterDto {
  id: ClusterId | string;
  /**
   * Current backends return primitive IDs. Object refs and the optional
   * `scores` field let newer deployments expose model scores without breaking
   * older clients.
   */
  track_ids: Array<string | number | ClusterTrackRefDto>;
  scores?: number[] | Record<string, number>;
  neighbors?: ClusterNeighborDto[];
}

export interface ClusterResponseDto {
  clusters: ClusterDto[];
}

export interface ClusterHydrated {
  id: ClusterId;
  tracks: Track[];
  neighbors?: ClusterNeighborDto[];
}

export interface ClusterCandidateSource {
  clusterId: ClusterId;
  /** Zero-based position in the original server cluster. */
  rank: number;
  score?: number;
}

export interface ClusterCandidate {
  track: Track;
  /** Every cluster that nominated this track, including consensus outside the hydration window. */
  sources: ClusterCandidateSource[];
}

export interface ClusterData {
  clusters: ClusterHydrated[];
  candidates: ClusterCandidate[];
  /** Backwards-compatible round-robin view used by the existing wave surfaces. */
  allTracks: Track[];
}
