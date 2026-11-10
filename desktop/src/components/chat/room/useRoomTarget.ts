import { useMemo } from 'react';
import { chatBridge } from '../../../lib/chat/bridge';
import type { BackdropPresetId, MediaRef } from '../../../lib/chat/media-types';
import type { ConvId } from '../../../lib/chat/types';
import { art } from '../../../lib/formatters';
import type { RoomView } from '../../../lib/together/types';
import { useChatRoomStore } from '../../../stores/chat/room';
import type { BackdropAccess, BackdropTarget } from '../backdrop/target';

export function useRoomConversation(room: RoomView): ConvId | null {
  const stored = useChatRoomStore((state) => state.conversationId);
  return stored ?? room.chatId ?? null;
}

function accessOf(room: RoomView, host: boolean): BackdropAccess {
  if (!host) return 'role';
  if (room.perks === undefined) return 'loading';
  return room.perks.starHost === true ? 'ready' : 'star';
}

export function useRoomTarget(room: RoomView, host: boolean): BackdropTarget {
  const conversationId = useRoomConversation(room);
  const track = room.playback.track;
  const cover = track ? art(track.artwork_url || track.user?.avatar_url, 't200x200') : null;
  const access = accessOf(room, host);
  const { code, title, backdrop, backdropCooldownUntil } = room;
  const count = room.members.length;
  return useMemo(() => {
    const need = (): ConvId => {
      if (!conversationId) throw { code: 'not_ready' };
      return conversationId;
    };
    return {
      scene: 'room',
      conversationId,
      backdrop: backdrop ?? null,
      access,
      freePresets: false,
      cooldownUntil: backdropCooldownUntil ?? null,
      title: title || code,
      cover,
      count,
      set: (preset: BackdropPresetId | null) => chatBridge.roomBackdrop(code, need(), preset),
      upload: (path: string) => chatBridge.roomBackdropUpload(code, need(), path),
      uploadStored: (source: MediaRef) =>
        chatBridge.roomBackdropStored(code, need(), source.conversationId, source.mediaId),
    };
  }, [conversationId, backdrop, access, backdropCooldownUntil, title, code, cover, count]);
}
