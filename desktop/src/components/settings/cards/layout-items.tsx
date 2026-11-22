import type { ReactNode } from 'react';
import {
  AudioLines,
  Ban,
  Bookmark,
  ChartNoAxesColumn,
  Clock,
  Disc3,
  Gauge,
  HardDrive,
  Heart,
  ListMusic,
  ListPlus,
  MicVocal,
  Moon,
  repeatAbIcon16,
  repeatIcon16,
  SlidersHorizontal,
  Sparkles,
  shuffleIcon16,
  ThumbsDown,
  Users,
  Volume2,
  Waves,
} from '../../../lib/icons';
import type { LayoutId, LayoutScope } from '../../../lib/layout';
import { NAV_ITEMS } from '../../layout/nav-items';
import { SuperHeart } from '../../music/superlike/SuperHeart';
import { Mic } from '../../voice/icons';

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
  shelf: { icon: <Heart size={16} />, label: 'home.shelf' },
  releases: { icon: <Sparkles size={16} />, label: 'releases.title' },
  superlikes: { icon: <SuperHeart size={16} />, label: 'superlikes.title' },
  likes: { icon: <Heart size={16} />, label: 'library.likedTracks' },
  recommended: { icon: <Sparkles size={16} />, label: 'home.recommended' },
};

const PLAYER_ITEMS: Record<LayoutId<'player'>, ItemMeta> = {
  like: { icon: <Heart size={16} />, label: 'track.like' },
  dislike: { icon: <ThumbsDown size={16} />, label: 'track.dislike' },
  addToPlaylist: { icon: <ListPlus size={16} />, label: 'playlist.addToPlaylist' },
  album: { icon: <Disc3 size={16} />, label: 'track.album' },
  block: { icon: <Ban size={16} />, label: 'blocklist.playerTitle' },
  quality: { icon: <Gauge size={16} />, label: 'player.qualityName' },
  shuffle: { icon: shuffleIcon16, label: 'player.shuffle' },
  repeat: { icon: repeatIcon16, label: 'player.repeat' },
  abLoop: { icon: repeatAbIcon16, label: 'player.abLoopName' },
  together: { icon: <Users size={16} />, label: 'together.title' },
  mic: { icon: <Mic size={16} />, label: 'voice.mic.button' },
  sleep: { icon: <Moon size={16} />, label: 'sleep.title' },
  tuning: { icon: <SlidersHorizontal size={16} />, label: 'player.soundTuning' },
  eq: { icon: <AudioLines size={16} />, label: 'eq.title' },
  effects: { icon: <Waves size={16} />, label: 'effects.title' },
  lyrics: { icon: <MicVocal size={16} />, label: 'track.lyrics' },
  queue: { icon: <ListMusic size={16} />, label: 'player.queue' },
  volume: { icon: <Volume2 size={16} />, label: 'player.volume' },
};

export function itemMeta(scope: LayoutScope, id: string): ItemMeta {
  if (scope === 'library') return LIBRARY_ITEMS[id as LayoutId<'library'>];
  if (scope === 'home') return HOME_ITEMS[id as LayoutId<'home'>];
  if (scope === 'player') return PLAYER_ITEMS[id as LayoutId<'player'>];
  const nav = NAV_ITEMS[id as LayoutId<'sidebar'>];
  return { icon: <nav.icon size={16} strokeWidth={1.9} />, label: nav.label };
}
