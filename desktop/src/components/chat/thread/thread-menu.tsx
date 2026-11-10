import type { TFunction } from 'i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { BellOff, Timer as SlowIcon, Timer } from '../../../lib/chat/icons';
import { ttlLabel } from '../../../lib/chat/render';
import { type ConversationSummary, DISAPPEARING_TTLS } from '../../../lib/chat/types';
import { Bell, Info, Shield, X } from '../../../lib/icons';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { type ContextMenuEntry, openContextMenu } from '../../../stores/context-menu';
import { backdropEntries } from '../backdrop/menu';
import type { InfoTab } from '../info/InfoSheet';
import { openSlowModeMenu } from '../public/SlowModeChip';
import { toastError } from './errors';
import { canSetTimer, hasTimer, isActiveMember, isPublicStaff } from './permissions';

type MenuEvent = Pick<MouseEvent, 'clientX' | 'clientY' | 'preventDefault'>;

const TIMER_CHOICES: (number | null)[] = [null, ...DISAPPEARING_TTLS];

export function isMuted(conversation: ConversationSummary, now: number): boolean {
  return conversation.mutedUntil !== null && conversation.mutedUntil > now;
}

export function setMuted(conversation: ConversationSummary, muted: boolean) {
  return chatBridge
    .conversationUpdate(conversation.id, {
      me: { mute: muted ? { kind: 'forever' } : { kind: 'off' } },
    })
    .then((summary) => useChatThreadStore.getState().setConversation(summary));
}

export function chooseTimer(conversation: ConversationSummary, ttlS: number | null) {
  if (conversation.ttlS === ttlS) return Promise.resolve();
  return useChatThreadStore.getState().setTtl(conversation.id, ttlS);
}

export function openTimerMenu(
  event: MenuEvent,
  conversation: ConversationSummary,
  t: TFunction,
  language: string,
) {
  const entries: ContextMenuEntry[] = TIMER_CHOICES.map((ttlS) => ({
    id: `ttl-${ttlS ?? 'off'}`,
    label: ttlLabel(ttlS, t),
    icon: ttlS ? <Timer size={14} /> : <X size={14} />,
    checked: (conversation.ttlS ?? null) === ttlS,
    disabled: !canSetTimer(conversation),
    onSelect: () => void chooseTimer(conversation, ttlS).catch((e) => toastError(e, t, language)),
  }));
  openContextMenu(
    event,
    entries,
    <div className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-semibold text-ink-45">
      {t('chat.thread.timer.title')}
    </div>,
  );
}

export function openThreadMenu(
  event: MenuEvent,
  conversation: ConversationSummary,
  t: TFunction,
  language: string,
  onInfo: (tab?: InfoTab) => void,
) {
  const muted = isMuted(conversation, Date.now());
  const entries: ContextMenuEntry[] = [
    {
      id: 'info',
      label: t('chat.thread.menu.info'),
      icon: <Info size={14} />,
      onSelect: () => onInfo(),
    },
  ];
  if (isPublicStaff(conversation)) {
    entries.push(
      {
        id: 'slow',
        label: t('chat.public.slow.title'),
        hint: conversation.slowModeS > 0 ? `${conversation.slowModeS}s` : undefined,
        icon: <SlowIcon size={14} />,
        onSelect: () => requestAnimationFrame(() => openSlowModeMenu(event, conversation, t)),
      },
      {
        id: 'moderation',
        label: t('chat.public.menu.log'),
        icon: <Shield size={14} />,
        onSelect: () => onInfo('log'),
      },
    );
  }
  if (hasTimer(conversation) && isActiveMember(conversation)) {
    entries.push({
      id: 'timer',
      label: t('chat.thread.timer.title'),
      hint: conversation.ttlS ? ttlLabel(conversation.ttlS, t) : undefined,
      icon: <Timer size={14} />,
      disabled: !canSetTimer(conversation),
      onSelect: () => requestAnimationFrame(() => openTimerMenu(event, conversation, t, language)),
    });
  }
  if (conversation.kind !== 'self' && isActiveMember(conversation)) {
    entries.push({
      id: 'mute',
      label: t(muted ? 'chat.thread.menu.unmute' : 'chat.thread.menu.mute'),
      icon: muted ? <Bell size={14} /> : <BellOff size={14} />,
      onSelect: () => void setMuted(conversation, !muted).catch((e) => toastError(e, t, language)),
    });
  }
  entries.push(...backdropEntries(conversation, t, (e) => toastError(e, t, language)));
  openContextMenu(event, entries);
}
