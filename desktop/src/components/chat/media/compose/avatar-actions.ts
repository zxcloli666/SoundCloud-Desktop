import type { TFunction } from 'i18next';
import { chatBridge } from '../../../../lib/chat/bridge';
import { IMAGE_EXTENSIONS } from '../../../../lib/chat/image-files';
import type { ConvId } from '../../../../lib/chat/types';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { useChatThreadStore } from '../../../../stores/chat/thread';
import { notifyFailure } from './failure';

export async function pickAvatar(conversationId: ConvId, t: TFunction) {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({
    multiple: false,
    directory: false,
    title: t('chat.media.avatar.title'),
    filters: [{ name: t('chat.media.avatar.title'), extensions: IMAGE_EXTENSIONS }],
  });
  const path = Array.isArray(picked) ? picked[0] : picked;
  if (!path) return;
  try {
    const upload = await chatBridge.mediaAvatar(conversationId, path);
    useChatMediaStore.getState().applyUploads({ uploads: [upload], removed: [] });
  } catch (error) {
    notifyFailure(error, t);
  }
}

export async function clearAvatar(conversationId: ConvId, t: TFunction) {
  try {
    const summary = await chatBridge.conversationUpdate(conversationId, {
      avatar: { kind: 'clear' },
    });
    useChatThreadStore.getState().setConversation(summary);
  } catch (error) {
    notifyFailure(error, t);
  }
}
