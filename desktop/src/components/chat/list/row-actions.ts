import { toast } from 'sonner';
import i18n from '../../../i18n';
import { chatBridge } from '../../../lib/chat/bridge';
import type { ConversationSummary, ConvId, MyPatch, UserRef } from '../../../lib/chat/types';
import { notifyError } from '../../../lib/notify';
import { useChatListStore } from '../../../stores/chat/list';
import { listErrorKey } from '../shell/errors';

function fail(error: unknown) {
  notifyError(i18n.t(listErrorKey(error)));
}

export async function patchMine(conversationId: ConvId, me: MyPatch) {
  try {
    const summary = await chatBridge.conversationUpdate(conversationId, { me });
    useChatListStore.getState().upsert(summary);
  } catch (error) {
    fail(error);
  }
}

export async function markRead(conversation: ConversationSummary) {
  try {
    await chatBridge.markRead(conversation.id, conversation.lastSeq);
    useChatListStore.getState().upsert({
      ...conversation,
      unread: 0,
      mentions: 0,
      lastReadSeq: conversation.lastSeq,
    });
  } catch (error) {
    fail(error);
  }
}

export async function blockUser(user: UserRef): Promise<boolean> {
  try {
    await chatBridge.block(user.id);
    toast(i18n.t('chat.list.blockedToast', { name: user.name }));
    return true;
  } catch (error) {
    fail(error);
    return false;
  }
}
