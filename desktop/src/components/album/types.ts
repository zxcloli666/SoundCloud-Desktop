import type { Track } from '../../stores/player';

export interface AlbumArtist {
  id: string;
  name: string;
  role: string;
  avatar_url?: string;
}

export interface AlbumDetail {
  id: string;
  title: string;
  type: string;
  release_year?: number;
  cover_url?: string;
  confidence: number;
  sc_playlist_urn?: string;
  primary_artist?: AlbumArtist;
  artists: AlbumArtist[];
  tracks: Track[];
}
