import type { RoomBackdrop } from '../../../lib/chat/media-types';
import { chatMediaUrl } from '../../../lib/chat/media-url';
import type { ConvId } from '../../../lib/chat/types';
import type { Scheme } from '../../../lib/scheme';
import { PRESETS } from './presets';
import type { BackdropPreset } from './presets/types';

export type ChoiceKey = 'none' | 'photo' | string;

export function currentKey(backdrop: RoomBackdrop | null): ChoiceKey {
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

export function imageSrcOf(
  backdrop: RoomBackdrop | null,
  conversationId: ConvId | null,
): string | null {
  return backdrop?.kind === 'image' && conversationId
    ? chatMediaUrl(conversationId, backdrop.mediaId, 'image')
    : null;
}
