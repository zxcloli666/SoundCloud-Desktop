import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConversationUsage } from '../../../lib/chat/media-types';
import { Check, ChevronDown, MessageCircle } from '../../../lib/icons';
import { useChatListStore } from '../../../stores/chat/list';
import { ConversationAvatar } from '../list/ConversationAvatar';
import { useFormatSize } from './bytes';
import { lookOf } from './conversation-look';
import { Panel, PanelTitle } from './Panel';
import { useStorageStore } from './storage-store';

const SHOWN = 5;

function UsageRow({
  row,
  total,
  active,
  onPick,
}: {
  row: ConversationUsage;
  total: number;
  active: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormatSize();
  const conversation = useChatListStore((state) => state.byId[row.conversation_id]);
  const look = lookOf(conversation, row.gone, t);
  const share = total > 0 ? Math.max(0.02, row.bytes / total) : 0;

  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      data-ui="chat-storage-chat"
      className={`group flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2 text-left outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/60 ${
        active ? 'bg-accent/[0.12]' : 'hover:bg-ink/[0.05]'
      }`}
    >
      <span className={`relative shrink-0 ${row.gone ? 'opacity-45 grayscale' : ''}`}>
        <ConversationAvatar kind={look.kind} src={look.avatar} name={look.title} size={32} />
        {active && (
          <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-accent text-accent-contrast ring-2 ring-[rgb(var(--surface))]">
            <Check size={10} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex min-w-0 items-baseline justify-between gap-2">
          <span
            className={`truncate text-[13px] font-semibold ${row.gone ? 'text-ink-45 line-through decoration-ink/30' : 'text-ink-85'}`}
          >
            {look.title}
          </span>
          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-70">
            {format(row.bytes)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
            <span
              className="block h-full origin-left rounded-full transition-transform duration-700 ease-[var(--ease-apple)] storage-motion"
              style={{
                transform: `scaleX(${share})`,
                background: row.gone ? 'rgb(var(--ink) / 0.3)' : 'var(--color-accent)',
              }}
            />
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-ink-45">
            {row.gone
              ? t('chat.storage.chats.gone')
              : t('chat.storage.files', { count: row.files })}
          </span>
        </span>
      </span>
    </button>
  );
}

export const ChatUsageList = memo(function ChatUsageList() {
  const { t } = useTranslation();
  const usage = useStorageStore((state) => state.usage);
  const origin = useStorageStore((state) => state.origin);
  const setOrigin = useStorageStore((state) => state.setOrigin);
  const listLoad = useChatListStore((state) => state.load);
  const nextCursor = useChatListStore((state) => state.nextCursor);
  const byId = useChatListStore((state) => state.byId);
  const [open, setOpen] = useState(false);
  const missing = usage?.conversations.some((row) => !byId[row.conversation_id]) ?? false;

  useEffect(() => {
    if (listLoad === 'idle') void useChatListStore.getState().refresh();
  }, [listLoad]);

  useEffect(() => {
    if (missing && nextCursor && listLoad === 'ready') void useChatListStore.getState().loadMore();
  }, [missing, nextCursor, listLoad]);

  if (!usage || usage.conversations.length === 0) return null;
  const rows = open ? usage.conversations : usage.conversations.slice(0, SHOWN);
  const hidden = usage.conversations.length - SHOWN;

  return (
    <Panel ui="chat-storage-chats" className="p-3">
      <div className="px-2.5 pt-1.5 pb-2">
        <PanelTitle icon={<MessageCircle size={13} />} title={t('chat.storage.chats.title')} />
      </div>
      <div className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <UsageRow
            key={row.conversation_id}
            row={row}
            total={usage.bytes}
            active={origin === row.conversation_id}
            onPick={() => setOrigin(origin === row.conversation_id ? null : row.conversation_id)}
          />
        ))}
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold text-ink-55 outline-none transition-colors hover:bg-ink/[0.05] hover:text-ink-80 focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {open ? t('chat.storage.chats.less') : t('chat.storage.chats.more', { count: hidden })}
          <ChevronDown
            size={13}
            className={`transition-transform duration-300 storage-motion ${open ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </Panel>
  );
});
