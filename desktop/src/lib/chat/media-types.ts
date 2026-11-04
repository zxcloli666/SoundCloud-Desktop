import type { ConvId, Millis } from './types';

export type MediaId = string;
export type MediaVariant = 'thumb' | 'image';
export type MediaKind = 'image' | 'avatar';

export interface MediaLimits {
  imageMaxBytes: number;
  thumbMaxBytes: number;
  avatarMaxBytes: number;
  albumMax: number;
  roomAlbumMax: number;
  restoreWindowS: number;
}

export interface MediaConfig {
  uploads: boolean;
  star: boolean;
  quota: number;
  used: number;
  limits: MediaLimits;
}

export type MediaUrl =
  | { state: 'ok'; id: MediaId; url: string }
  | { state: 'deleted'; id: MediaId }
  | { state: 'lost'; id: MediaId };

export interface UrlsAnswer {
  expires_in_s: number;
  items: MediaUrl[];
}

export interface ConversationUsage {
  conversation_id: ConvId;
  bytes: number;
  files: number;
  gone: boolean;
}

export interface MediaUsage {
  bytes: number;
  reserved: number;
  quota: number;
  files: number;
  conversations: ConversationUsage[];
}

export type MineOrder = 'new' | 'old' | 'big';

export interface MineQuery {
  order?: MineOrder;
  conversationId?: ConvId | null;
  cursor?: string | null;
  limit?: number;
}

export type MyMediaStatus = 'uploaded' | 'attached' | 'lost';

export interface MyMedia {
  id: MediaId;
  kind: MediaKind;
  conversation_id: ConvId;
  thumb_id: MediaId | null;
  bytes: number;
  status: MyMediaStatus;
  chats: number;
  created_at: Millis;
}

export interface MinePage {
  items: MyMedia[];
  next_cursor: string | null;
}

export interface MediaSelection {
  ids?: MediaId[];
  all?: boolean;
}

export interface DeleteAnswer {
  deleted: number;
  freed: number;
  used: number;
  quota: number;
}

export interface RestoreAnswer {
  restored: number;
  missed: number;
  used: number;
  quota: number;
}

export type UploadState = 'queued' | 'reserved' | 'uploading' | 'uploaded' | 'committed' | 'failed';

export interface UploadView {
  id: string;
  album: string;
  position: number;
  conversationId: ConvId;
  kind: MediaKind;
  state: UploadState;
  object: 'image' | 'thumb';
  partsSent: number;
  imageBytes: number;
  thumbBytes: number;
  attempts: number;
  updatedAt: Millis;
}

export interface MediaUploadsEvent {
  uploads: UploadView[];
  removed: string[];
}

export interface MessageAttachment {
  mediaId: MediaId;
  kind: 'image';
  size: number;
  w: number;
  h: number;
  thumbhash: number[];
}

export type AvatarChange = { kind: 'set'; uploadId: string } | { kind: 'clear' };

export type RoomImagesPolicy = 'members' | 'mods' | 'off';

export interface RoomCover {
  url: string;
  accent: number;
}
