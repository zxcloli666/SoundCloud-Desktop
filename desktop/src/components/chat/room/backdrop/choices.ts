import type { UploadView } from '../../../../lib/chat/media-types';
import { chatMediaUrl } from '../../../../lib/chat/media-url';
import type { ChatError, ConvId } from '../../../../lib/chat/types';
import type { Scheme } from '../../../../lib/scheme';
import type { RoomView } from '../../../../lib/together/types';
import { PRESETS } from '../presets';
import type { BackdropPreset } from '../presets/types';
import type { PhotoState } from './PhotoTile';

export type ChoiceKey = 'none' | 'photo' | string;

export function currentKey(room: RoomView): ChoiceKey {
  const backdrop = room.backdrop ?? null;
  if (!backdrop) return 'none';
  return backdrop.kind === 'image' ? 'photo' : backdrop.id;
}

export function orderedPresets(scheme: Scheme): BackdropPreset[] {
  const first = scheme === 'white' ? 'light' : 'dark';
  return [
    ...PRESETS.filter((preset) => preset.tone === first),
    ...PRESETS.filter((preset) => preset.tone !== first),
  ];
}

export function roomImageSrc(room: RoomView, conversationId: ConvId | null): string | null {
  const backdrop = room.backdrop ?? null;
  return backdrop?.kind === 'image' && conversationId
    ? chatMediaUrl(conversationId, backdrop.mediaId, 'image')
    : null;
}

export type UploadStatus = { kind: 'active'; upload: UploadView } | { kind: 'failed' } | null;

export function uploadStatus(upload: UploadView | null, error: ChatError | null): UploadStatus {
  if (upload && upload.state !== 'failed' && upload.state !== 'committed') {
    return { kind: 'active', upload };
  }
  if (upload?.state === 'failed' || error) return { kind: 'failed' };
  return null;
}

export function photoState(
  status: UploadStatus,
  imageSrc: string | null,
  cooldownMs: number,
): PhotoState {
  if (status?.kind === 'active') return { kind: 'uploading', upload: status.upload };
  if (status?.kind === 'failed') return { kind: 'failed' };
  if (cooldownMs > 0) return { kind: 'cooldown', leftMs: cooldownMs };
  if (imageSrc) return { kind: 'current', src: imageSrc };
  return { kind: 'idle' };
}
