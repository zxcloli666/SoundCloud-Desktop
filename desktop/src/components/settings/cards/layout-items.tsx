import type { ReactNode } from 'react';
import {
  AudioLines,
  Bookmark,
  ChartNoAxesColumn,
  Clock,
  Disc3,
  HardDrive,
  Heart,
  ListMusic,
  Sparkles,
  ThumbsDown,
  Users,
} from '../../../lib/icons';
import type { LayoutId, LayoutScope } from '../../../lib/layout';
import { NAV_ITEMS } from '../../layout/nav-items';
import { SuperHeart } from '../../music/superlike/SuperHeart';

export type ItemMeta = { icon: ReactNode; label: string };

const LIBRARY_ITEMS: Record<LayoutId<'library'>, ItemMeta> = {
  fresh: { icon: <Sparkles size={16} />, label: 'library.freshFromFollowing' },
  continue: { icon: <Clock size={16} />, label: 'library.continue' },
  stats: { icon: <ChartNoAxesColumn size={16} />, label: 'stats.teaserTitle' },
  playlists: { icon: <ListMusic size={16} />, label: 'library.yourPlaylists' },
  likedPlaylists: { icon: <Bookmark size={16} />, label: 'library.likedPlaylists' },
  likedAlbums: { icon: <Disc3 size={16} />, label: 'library.likedAlbums' },
  local: { icon: <HardDrive size={16} />, label: 'local.libraryTitle' },
  artists: { icon: <Users size={16} />, label: 'library.artists' },
  superlikes: { icon: <SuperHeart size={16} />, label: 'superlikes.title' },
  likes: { icon: <Heart size={16} />, label: 'library.likedTracks' },
  dislikes: { icon: <ThumbsDown size={16} />, label: 'dislikes.title' },
};

const HOME_ITEMS: Record<LayoutId<'home'>, ItemMeta> = {
  river: { icon: <AudioLines size={16} />, label: 'settings.layoutRiver' },
  releases: { icon: <Sparkles size={16} />, label: 'releases.title' },
  superlikes: { icon: <SuperHeart size={16} />, label: 'superlikes.title' },
  likes: { icon: <Heart size={16} />, label: 'library.likedTracks' },
  recommended: { icon: <Sparkles size={16} />, label: 'home.recommended' },
};

export function itemMeta(scope: LayoutScope, id: string): ItemMeta {
  if (scope === 'library') return LIBRARY_ITEMS[id as LayoutId<'library'>];
  if (scope === 'home') return HOME_ITEMS[id as LayoutId<'home'>];
  const nav = NAV_ITEMS[id as LayoutId<'sidebar'>];
  return { icon: <nav.icon size={16} strokeWidth={1.9} />, label: nav.label };
}
