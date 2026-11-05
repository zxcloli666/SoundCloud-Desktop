import type { TFunction } from 'i18next';
import { Flag, Pin, Reply } from '../../../lib/chat/icons';
import type { ConversationSummary, Message } from '../../../lib/chat/types';
import { Copy, Pencil, RotateCcw, Trash2, X } from '../../../lib/icons';
import { useChatThreadStore } from '../../../stores/chat/thread';
import type { ContextMenuEntry } from '../../../stores/context-menu';
import { useThreadDialogs } from '../thread/dialogs';
import { toastError } from '../thread/errors';
import { canEdit, canForward, canPin, canReport, isActiveMember } from '../thread/permissions';

function copyText(message: Message) {
  if (message.body.type !== 'text') return;
  const selection = window.getSelection()?.toString() ?? '';
  void navigator.clipboard.writeText(selection.trim() ? selection : message.body.text);
}

export function startReply(message: Message) {
  if (message.seq === null) return;
  useChatThreadStore
    .getState()
    .setCompose(message.conversationId, { reply: message.seq, edit: null });
}

export function startEdit(message: Message) {
  useChatThreadStore
    .getState()
    .setCompose(message.conversationId, { edit: message.clientId, reply: null });
}

export function messageMenu(
  message: Message,
  conversation: ConversationSummary,
  moderator: boolean,
  t: TFunction,
  language: string,
): ContextMenuEntry[] {
  const store = useChatThreadStore.getState();
  const dialogs = useThreadDialogs.getState();
  const fail = (error: unknown) => toastError(error, t, language);
  const sent = message.seq !== null;
  const text = message.body.type === 'text';
  const active = isActiveMember(conversation);
  const top: ContextMenuEntry[] = [];
  const bottom: ContextMenuEntry[] = [];

  if (message.state === 'failed') {
    top.push({
      id: 'retry',
      label: t('chat.thread.actions.retry'),
      icon: <RotateCcw size={14} />,
      onSelect: () => void store.retry(message).catch(fail),
    });
  }
  if (sent && text && active) {
    top.push({
      id: 'reply',
      label: t('chat.thread.actions.reply'),
      icon: <Reply size={14} />,
      onSelect: () => startReply(message),
    });
  }
  if (canForward(message, conversation)) {
    top.push({
      id: 'forward',
      label: t('chat.thread.actions.forward'),
      icon: <Reply size={14} className="-scale-x-100" />,
      onSelect: () =>
        dialogs.open({ kind: 'forward', conversationId: message.conversationId, message }),
    });
  }
  if (message.body.type === 'text' && message.body.text) {
    top.push({
      id: 'copy',
      label: t('chat.thread.actions.copy'),
      icon: <Copy size={14} />,
      onSelect: () => copyText(message),
    });
  }
  if (active && canEdit(message, Date.now())) {
    top.push({
      id: 'edit',
      label: t('chat.thread.actions.edit'),
      icon: <Pencil size={14} />,
      onSelect: () => startEdit(message),
    });
  }
  if (sent && text && canPin(conversation, moderator)) {
    top.push({
      id: 'pin',
      label: t(message.pinned ? 'chat.thread.actions.unpin' : 'chat.thread.actions.pin'),
      icon: <Pin size={14} />,
      onSelect: () => void store.pin(message, !message.pinned).catch(fail),
    });
  }

  if (!sent) {
    bottom.push({
      id: 'discard',
      label: t('chat.thread.actions.discard'),
      icon: <X size={14} />,
      onSelect: () => void store.discard(message).catch(fail),
    });
  } else {
    bottom.push({
      id: 'delete',
      label: t('chat.thread.actions.delete'),
      icon: <Trash2 size={14} />,
      onSelect: () =>
        dialogs.open({ kind: 'delete', conversationId: message.conversationId, message }),
    });
  }
  if (canReport(message)) {
    bottom.push({
      id: 'report',
      label: t('chat.thread.actions.report'),
      icon: <Flag size={14} />,
      onSelect: () =>
        dialogs.open({ kind: 'report', conversationId: message.conversationId, message }),
    });
  }

  return top.length > 0 ? [...top, 'separator', ...bottom] : bottom;
}
