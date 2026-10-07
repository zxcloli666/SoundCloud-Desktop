import type { Track } from '../../stores/player';

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
  positionMs: number;
  at: number;
  rate: number;
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
}

export interface PlaybackUpdate {
  status: RoomStatus;
  track?: Track | null;
  trackUrn?: string | null;
  positionMs?: number;
  leadMs?: number;
  rate?: number;
}

export interface Profile {
  name: string;
  avatarUrl: string | null;
}
