export type TrackList = 'queue' | 'likes' | 'superlikes' | 'history';

export const TRACK_LISTS: TrackList[] = ['queue', 'likes', 'superlikes', 'history'];

export interface Listed {
  n: number;
  title: string;
  artist: string;
  id: string;
}
