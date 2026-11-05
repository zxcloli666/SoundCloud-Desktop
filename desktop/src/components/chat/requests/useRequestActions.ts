import { useMemo } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import i18n from '../../../i18n';
import { chatBridge } from '../../../lib/chat/bridge';
import type { ConversationSummary, UserRef } from '../../../lib/chat/types';
import { notifyError } from '../../../lib/notify';
import { useChatListStore } from '../../../stores/chat/list';
import { useChatPrefsStore } from '../../../stores/chat/prefs';
import { blockUser } from '../list/row-actions';
import { listErrorKey } from '../shell/errors';
import { openReport } from './report-store';

const REPORT_RANGE = 50;

function fail(error: unknown) {
  notifyError(i18n.t(listErrorKey(error)));
}

export function useRequestActions() {
  const navigate = useNavigate();
  const openId = useMatch('/chats/:id')?.params.id ?? null;

  return useMemo(() => {
    const leave = (conversation: ConversationSummary) => {
      useChatPrefsStore.getState().closeTab(conversation.id);
      if (openId === conversation.id) navigate('/chats');
    };

    const accept = async (conversation: ConversationSummary) => {
      try {
        const summary = await chatBridge.accept(conversation.id);
        useChatListStore.getState().settleRequest(summary);
      } catch (error) {
        fail(error);
      }
    };

    const decline = async (conversation: ConversationSummary) => {
      try {
        await chatBridge.decline(conversation.id);
        useChatListStore.getState().remove(conversation.id);
        useChatListStore
          .getState()
          .setRequests(Math.max(0, useChatListStore.getState().requests - 1));
        leave(conversation);
      } catch (error) {
        fail(error);
      }
    };

    const block = async (conversation: ConversationSummary, user: UserRef) => {
      if (await blockUser(user)) await decline(conversation);
    };

    const report = (conversation: ConversationSummary, user: UserRef) => {
      const seqTo = Math.max(1, conversation.lastSeq);
      openReport({
        conversationId: conversation.id,
        seqFrom: Math.max(1, seqTo - REPORT_RANGE + 1),
        seqTo,
        name: user.name,
        userId: user.id,
      });
    };

    return { accept, decline, block, report };
  }, [navigate, openId]);
}
