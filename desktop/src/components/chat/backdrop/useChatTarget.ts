import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import type { BackdropPresetId, MediaRef } from '../../../lib/chat/media-types';
import { conversationAvatar, conversationTitle } from '../../../lib/chat/render';
import type { ConversationSummary, Member } from '../../../lib/chat/types';
import { useChatStore } from '../../../stores/chat';
import { selectMediaStar } from '../../../stores/chat/media';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { backdropAccess, peerReady } from './access';
import type { BackdropAccess, BackdropScene, BackdropTarget } from './target';

const NO_MEMBERS: Member[] = [];

export function useBackdropAccess(conversation: ConversationSummary): BackdropAccess {
  const star = useChatStore(selectMediaStar);
  const me = useChatStore((state) => state.status?.userId ?? null);
  const direct = conversation.kind === 'direct';
  const members = useChatThreadStore((state) =>
    direct ? (state.threads[conversation.id]?.members ?? NO_MEMBERS) : NO_MEMBERS,
  );
  const unknown = direct && members.length === 0;

  useEffect(() => {
    if (unknown) void useChatThreadStore.getState().loadMembers(conversation.id);
  }, [unknown, conversation.id]);

  return backdropAccess(conversation, star, direct ? peerReady(members, me) : true);
}

export function useChatTarget(conversation: ConversationSummary): BackdropTarget {
  const { t } = useTranslation();
  const access = useBackdropAccess(conversation);
  const { id, kind, backdrop, memberCount } = conversation;
  const title = conversationTitle(conversation, t);
  const cover = conversationAvatar(conversation);
  return useMemo(
    () => ({
      scene: kind as BackdropScene,
      conversationId: id,
      backdrop,
      access,
      freePresets: kind === 'public',
      cooldownUntil: null,
      title,
      cover,
      count: kind === 'group' || kind === 'public' ? memberCount : null,
      set: (preset: BackdropPresetId | null) => chatBridge.backdropSet(id, preset),
      upload: (path: string) => chatBridge.backdropUpload(id, path),
      uploadStored: (source: MediaRef) =>
        chatBridge.backdropStored(id, source.conversationId, source.mediaId),
    }),
    [id, kind, backdrop, access, title, cover, memberCount],
  );
}
