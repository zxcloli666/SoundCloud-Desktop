import type { MediaId, RoomBackdrop } from '../../../lib/chat/media-types';
import type { ConvId } from '../../../lib/chat/types';
import { lookKey, selectHidden, useBackdropStore } from '../../../stores/chat/backdrop';
import { presetOf } from './presets';
import type { BackdropPreset } from './presets/types';

export type ShownBackdrop =
  | { kind: 'preset'; preset: BackdropPreset }
  | { kind: 'image'; conversationId: ConvId; mediaId: MediaId }
  | null;

export interface BackdropView {
  look: string | null;
  imageId: MediaId | null;
  hidden: boolean;
  shown: ShownBackdrop;
}

function shownOf(conversationId: ConvId | null, backdrop: RoomBackdrop | null): ShownBackdrop {
  if (backdrop?.kind === 'preset') {
    const preset = presetOf(backdrop.id);
    return preset ? { kind: 'preset', preset } : null;
  }
  if (backdrop?.kind === 'image' && conversationId) {
    return { kind: 'image', conversationId, mediaId: backdrop.mediaId };
  }
  return null;
}

export function useBackdropView(
  conversationId: ConvId | null,
  backdrop: RoomBackdrop | null,
): BackdropView {
  const look = lookKey(backdrop);
  const hidden = useBackdropStore(selectHidden(conversationId, look));
  const imageId = backdrop?.kind === 'image' ? backdrop.mediaId : null;
  return { look, imageId, hidden, shown: hidden ? null : shownOf(conversationId, backdrop) };
}
