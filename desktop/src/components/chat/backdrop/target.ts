import type {
  BackdropPresetId,
  MediaRef,
  RoomBackdrop,
  UploadView,
} from '../../../lib/chat/media-types';
import type { ConvId } from '../../../lib/chat/types';

export type BackdropAccess = 'loading' | 'ready' | 'star' | 'role' | 'pending';

export type BackdropScene = 'room' | 'direct' | 'group' | 'self' | 'public';

export interface BackdropTarget {
  scene: BackdropScene;
  conversationId: ConvId | null;
  backdrop: RoomBackdrop | null;
  access: BackdropAccess;
  freePresets: boolean;
  cooldownUntil: number | null;
  title: string;
  cover: string | null;
  count: number | null;
  set: (preset: BackdropPresetId | null) => Promise<void>;
  upload: (path: string) => Promise<UploadView | null>;
  uploadStored: (source: MediaRef) => Promise<UploadView | null>;
}

export function locksAll(access: BackdropAccess): boolean {
  return access === 'role' || access === 'pending';
}
