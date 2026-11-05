import type { TFunction } from 'i18next';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer } from '../../../lib/chat/icons';
import { systemText } from '../../../lib/chat/render';
import { dayLabel } from '../../../lib/chat/time';
import type { Message } from '../../../lib/chat/types';
import { roomRowKind } from '../../../lib/together/room-rows';
import { RoomSystemRow } from '../room/RoomSystemRow';
import { useThread } from './context';

export function dayText(ts: number, t: TFunction, language: string): string {
  const label = dayLabel(ts, Date.now(), language);
  if (label.kind === 'today') return t('chat.thread.day.today');
  if (label.kind === 'yesterday') return t('chat.thread.day.yesterday');
  return label.text;
}

export const DaySeparator = memo(function DaySeparator({ ts }: { ts: number }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex justify-center px-3 pt-4 pb-3">
      <span className="rounded-full bg-ink/[0.05] px-3 py-1 text-[11px] font-semibold text-ink-50">
        {dayText(ts, t, i18n.language)}
      </span>
    </div>
  );
});

export const UnreadDivider = memo(function UnreadDivider({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-3 pt-4 pb-3" role="separator">
      <span className="h-px flex-1" style={{ background: 'var(--color-accent-glow)' }} />
      <span className="text-[11px] font-semibold" style={{ color: 'var(--color-accent-hover)' }}>
        {t('chat.thread.unread', { count })}
      </span>
      <span className="h-px flex-1" style={{ background: 'var(--color-accent-glow)' }} />
    </div>
  );
});

export const SystemRow = memo(function SystemRow({ message }: { message: Message }) {
  const { t, i18n } = useTranslation();
  const { nameOf, conversation } = useThread();
  if (message.body.type !== 'system') return null;
  const roomKind = conversation.kind === 'room' ? roomRowKind(message.body) : null;
  if (roomKind) {
    return (
      <div data-ui="chat-system-row" data-kind={roomKind}>
        <RoomSystemRow event={message.body} nameOf={nameOf} />
      </div>
    );
  }
  const timer = message.body.kind === 'ttl';
  return (
    <div
      data-ui="chat-system-row"
      data-kind={message.body.kind}
      className="flex justify-center px-6 pt-2.5 pb-3"
    >
      <span
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-center text-[11.5px] ${
          timer ? 'bg-ink/[0.06] text-ink-70' : 'text-ink-45'
        }`}
      >
        {timer && <Timer size={12} className="shrink-0" />}
        <span className="min-w-0 truncate">
          {systemText(message.body, nameOf, t, i18n.language)}
        </span>
      </span>
    </div>
  );
});
