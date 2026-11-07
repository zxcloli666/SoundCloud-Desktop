import type { TFunction } from 'i18next';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer } from '../../../lib/chat/icons';
import { type ConversationSummary, PUBLIC_SLOW_MODE_SECONDS } from '../../../lib/chat/types';
import { X } from '../../../lib/icons';
import { type ContextMenuEntry, openContextMenu } from '../../../stores/context-menu';
import { isPublicStaff } from '../thread/permissions';
import { durationLabel, setSlowMode } from './actions';

type MenuEvent = Pick<MouseEvent, 'clientX' | 'clientY' | 'preventDefault'>;

export function slowShort(seconds: number, t: TFunction): string {
  if (seconds % 60 === 0) return t('chat.public.slow.minutes', { value: seconds / 60 });
  return t('chat.public.slow.seconds', { value: seconds });
}

export function openSlowModeMenu(
  event: MenuEvent,
  conversation: ConversationSummary,
  t: TFunction,
) {
  const entries: ContextMenuEntry[] = PUBLIC_SLOW_MODE_SECONDS.map((seconds) => ({
    id: `slow-${seconds}`,
    label: seconds === 0 ? t('chat.public.slow.off') : durationLabel(seconds),
    icon: seconds === 0 ? <X size={14} /> : <Timer size={14} />,
    checked: conversation.slowModeS === seconds,
    onSelect: () => {
      if (conversation.slowModeS !== seconds) void setSlowMode(conversation.id, seconds);
    },
  }));
  openContextMenu(
    event,
    entries,
    <div className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-semibold text-ink-45">
      {t('chat.public.slow.title')}
    </div>,
  );
}

export const SlowModeChip = memo(function SlowModeChip({
  conversation,
}: {
  conversation: ConversationSummary;
}) {
  const { t } = useTranslation();
  const staff = isPublicStaff(conversation);
  if (conversation.slowModeS <= 0 && !staff) return null;
  const on = conversation.slowModeS > 0;
  return (
    <button
      type="button"
      data-ui="chat-public-slow"
      title={t('chat.public.slow.title')}
      disabled={!staff}
      onClick={(event) => openSlowModeMenu(event, conversation, t)}
      className="flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold tabular-nums transition-colors duration-150 enabled:cursor-pointer enabled:hover:brightness-125 disabled:cursor-default"
      style={
        on
          ? { background: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }
          : { background: 'rgb(var(--ink) / 0.06)', color: 'rgb(var(--ink) / 0.5)' }
      }
    >
      <Timer size={13} />
      {on ? slowShort(conversation.slowModeS, t) : t('chat.public.slow.off')}
    </button>
  );
});
