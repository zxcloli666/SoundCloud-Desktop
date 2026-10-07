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
  | 'fans_also'
  | 'discover';

export interface ClusterNeighborDto {
  artist_id: string;
  artist_name: string;
  avatar_url?: string;
  track_id: string;
}

export interface ClusterNeighbor extends ClusterNeighborDto {
  track_urn: string;
}

export interface ClusterDto {
  id: ClusterId | string;
  track_ids: string[];
  track_urns?: string[];
  tracks?: Track[];
  neighbors?: ClusterNeighborDto[];
}

export interface ClusterResponseDto {
  clusters: ClusterDto[];
}

export interface ClusterHydrated {
  id: ClusterId;
  tracks: Track[];
  neighbors?: ClusterNeighbor[];
}

export interface ClusterData {
  clusters: ClusterHydrated[];
  allTracks: Track[];
}
