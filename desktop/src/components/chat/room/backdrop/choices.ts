import type { UploadView } from '../../../../lib/chat/media-types';
import { chatMediaUrl } from '../../../../lib/chat/media-url';
import type { ChatError, ConvId } from '../../../../lib/chat/types';
import type { Scheme } from '../../../../lib/scheme';
import type { RoomView } from '../../../../lib/together/types';
import { PRESETS } from '../presets';
import type { BackdropPreset } from '../presets/types';
import type { PhotoState } from './PhotoTile';

const STALE_COMMIT_MS = 60_000;

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

export function photoState(
  upload: UploadView | null,
  error: ChatError | null,
  imageSrc: string | null,
  cooldownMs: number,
  now: number,
): PhotoState {
  const fresh =
    upload && !(upload.state === 'committed' && now - upload.updatedAt > STALE_COMMIT_MS);
  if (upload && fresh) {
    if (upload.state === 'failed' || (upload.state === 'committed' && error))
      return { kind: 'failed' };
    if (upload.state !== 'committed' || !imageSrc) return { kind: 'uploading', upload };
  }
  if (cooldownMs > 0) return { kind: 'cooldown', leftMs: cooldownMs };
  if (imageSrc) return { kind: 'current', src: imageSrc };
  return { kind: 'idle' };
}
