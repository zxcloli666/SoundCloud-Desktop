import type { MediaId } from '../../../../lib/chat/media-types';
import type { ConvId } from '../../../../lib/chat/types';
import type { RoomView } from '../../../../lib/together/types';
import { selectHidden, useBackdropStore } from '../../../../stores/chat/backdrop';
import { useChatRoomStore } from '../../../../stores/chat/room';
import { presetOf } from '../presets';
import type { BackdropPreset } from '../presets/types';

export type ShownBackdrop =
  | { kind: 'preset'; preset: BackdropPreset }
  | { kind: 'image'; conversationId: ConvId; mediaId: MediaId }
  | null;

export interface RoomBackdropState {
  conversationId: ConvId | null;
  imageId: MediaId | null;
  hidden: boolean;
  shown: ShownBackdrop;
}

export function useRoomConversation(room: RoomView): ConvId | null {
  const stored = useChatRoomStore((state) => state.conversationId);
  return stored ?? room.chatId ?? null;
}

export function useRoomBackdrop(room: RoomView): RoomBackdropState {
  const conversationId = useRoomConversation(room);
  const backdrop = room.backdrop ?? null;
  const imageId = backdrop?.kind === 'image' ? backdrop.mediaId : null;
  const hidden = useBackdropStore(selectHidden(conversationId, imageId));
  if (backdrop?.kind === 'preset') {
    const preset = presetOf(backdrop.id);
    return { conversationId, imageId, hidden, shown: preset ? { kind: 'preset', preset } : null };
  }
  if (imageId && conversationId && !hidden) {
    return {
      conversationId,
      imageId,
      hidden,
      shown: { kind: 'image', conversationId, mediaId: imageId },
    };
  }
  return { conversationId, imageId, hidden, shown: null };
}
