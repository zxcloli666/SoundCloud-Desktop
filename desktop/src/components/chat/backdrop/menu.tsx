import type { TFunction } from 'i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { Flag } from '../../../lib/chat/icons';
import type { ConversationSummary } from '../../../lib/chat/types';
import { Eye, EyeOff, ImageIcon, X } from '../../../lib/icons';
import { useChatStore } from '../../../stores/chat';
import { hiddenKey, lookKey, useBackdropStore } from '../../../stores/chat/backdrop';
import type { ContextMenuEntry } from '../../../stores/context-menu';
import { clearsBackdrop, reportsBackdrop, setsBackdrop } from './access';

export function backdropEntries(
  conversation: ConversationSummary,
  t: TFunction,
  onError: (error: unknown) => void,
): ContextMenuEntry[] {
  const store = useBackdropStore.getState();
  const me = useChatStore.getState().status?.userId ?? null;
  const { id, backdrop } = conversation;
  const look = lookKey(backdrop);
  const entries: ContextMenuEntry[] = [];
  if (setsBackdrop(conversation)) {
    entries.push({
      id: 'backdrop',
      label: t('chat.backdrop.title'),
      icon: <ImageIcon size={14} />,
      onSelect: () => store.open('picker', id),
    });
  }
  if (look) {
    const hidden = hiddenKey(id, look) in store.hidden;
    entries.push({
      id: 'backdrop-hide',
      label: t(hidden ? 'chat.backdrop.show' : 'chat.backdrop.hide'),
      icon: hidden ? <Eye size={14} /> : <EyeOff size={14} />,
      onSelect: () => (hidden ? store.show(id, look) : store.hide(id, look)),
    });
  }
  if (reportsBackdrop(conversation, me)) {
    entries.push({
      id: 'backdrop-report',
      label: t('chat.backdrop.report.entry'),
      icon: <Flag size={14} />,
      onSelect: () => store.open('report', id),
    });
  }
  if (look && clearsBackdrop(conversation)) {
    entries.push({
      id: 'backdrop-clear',
      label: t('chat.backdrop.clear'),
      icon: <X size={14} />,
      onSelect: () => void chatBridge.backdropSet(id, null).catch(onError),
    });
  }
  return entries;
}
