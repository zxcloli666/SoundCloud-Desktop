export type WaitScope = 'likes' | 'playlists' | 'followings' | 'tracks';

export type WaitShape = 'rows' | 'covers' | 'avatars';

export const SHAPE_OF: Record<WaitScope, WaitShape> = {
  likes: 'rows',
  tracks: 'rows',
  playlists: 'covers',
  followings: 'avatars',
};
