import { chatMediaUrl } from '../../../../lib/chat/media-url';
import type { ConvId } from '../../../../lib/chat/types';
import type { Scheme } from '../../../../lib/scheme';
import type { RoomView } from '../../../../lib/together/types';
import { PRESETS } from '../presets';
import type { BackdropPreset } from '../presets/types';

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
