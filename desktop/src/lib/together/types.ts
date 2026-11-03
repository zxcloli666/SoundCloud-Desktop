import type { Track } from '../../stores/player';
import type { RoomCover, RoomImagesPolicy } from '../chat/media-types';

export const ROOM_CAPACITY = 10;

export type RoomStatus = 'idle' | 'loading' | 'playing' | 'paused';

export interface RoomMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: number;
  readyUrn: string | null;
}

export interface RoomPlayback {
  status: RoomStatus;
  track: Track | null;
  trackUrn: string | null;
  nextTrack?: Track | null;
  positionMs: number;
  at: number;
  rate: number;
  crossfadeSec?: number;
}

export interface RoomMute {
  userId: string;
  untilMs: number;
}

export interface RoomPerks {
  starHost: boolean;
  capacity: number;
  modsMax: number;
}

export interface RoomView {
  code: string;
  hostId: string;
  version: number;
  createdAt: number;
  members: RoomMember[];
  playback: RoomPlayback;
  online: string[];
  serverNow: number;
  public?: boolean;
  title?: string | null;
  chatId?: string | null;
  chatEnabled?: boolean;
  moderators?: string[];
  muted?: RoomMute[];
  slowModeS?: number;
  links?: boolean;
  banned?: string[];
  perks?: RoomPerks;
  cover?: RoomCover | null;
  roomImages?: RoomImagesPolicy;
}

export interface OpenRoomTrack {
  title: string;
  artist: string | null;
  artworkUrl: string | null;
}

export interface OpenRoom {
  hostId: string;
  hostName: string;
  hostAvatarUrl: string | null;
  status: RoomStatus;
  track: OpenRoomTrack | null;
  listeners: number;
  capacity: number;
  full: boolean;
  starHost?: boolean;
  cover?: RoomCover | null;
  createdAt: number;
}

export interface PlaybackUpdate {
  status: RoomStatus;
  track?: Track | null;
  trackUrn?: string | null;
  nextTrack?: Track | null;
  positionMs?: number;
  leadMs?: number;
  rate?: number;
  crossfadeSec?: number;
}

export interface Profile {
  name: string;
  avatarUrl: string | null;
}
