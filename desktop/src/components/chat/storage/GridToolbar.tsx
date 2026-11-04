import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MineOrder, MyMedia } from '../../../lib/chat/media-types';
import { Trash2, X } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { useChatListStore } from '../../../stores/chat/list';
import { KeyCap } from '../../ui/KeyCap';
import { ConversationAvatar } from '../list/ConversationAvatar';
import { useFormatSize } from './bytes';
import { lookOf } from './conversation-look';
import { useSelectionStore } from './selection-store';
import { useStorageStore } from './storage-store';

const ORDERS: MineOrder[] = ['new', 'old', 'big'];

const CHIP =
  'flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/60';

function OrderSwitch() {
  const { t } = useTranslation();
  const order = useStorageStore((state) => state.order);
  const setOrder = useStorageStore((state) => state.setOrder);
  return (
    <div
      role="radiogroup"
      aria-label={t('chat.storage.order.label')}
      className="flex shrink-0 items-center gap-0.5 rounded-full bg-ink/[0.05] p-0.5"
    >
      {ORDERS.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={order === value}
          onClick={() => setOrder(value)}
          className={`${CHIP} h-7 ${order === value ? 'bg-ink/[0.1] text-ink-90' : 'text-ink-50 hover:text-ink-80'}`}
        >
          {t(`chat.storage.order.${value}`)}
        </button>
      ))}
    </div>
  );
}

function OriginChip() {
  const { t } = useTranslation();
  const origin = useStorageStore((state) => state.origin);
  const setOrigin = useStorageStore((state) => state.setOrigin);
  const gone = useStorageStore(
    (state) =>
      state.usage?.conversations.find((row) => row.conversation_id === origin)?.gone ?? false,
  );
  const conversation = useChatListStore((state) => (origin ? state.byId[origin] : undefined));
  if (!origin) return null;
  const look = lookOf(conversation, gone, t);
  return (
    <button
      type="button"
      onClick={() => setOrigin(null)}
      aria-label={t('chat.storage.filter.clear', { name: look.title })}
      className={`${CHIP} min-w-0 max-w-[220px] bg-accent/[0.14] pl-1 text-ink-85 hover:bg-accent/[0.2]`}
    >
      <ConversationAvatar kind={look.kind} src={look.avatar} name={look.title} size={22} />
      <span className="truncate">{look.title}</span>
      <X size={12} className="shrink-0 text-ink-55" />
    </button>
  );
}

function SelectionBar({ items, onDelete }: { items: MyMedia[]; onDelete: () => void }) {
  const { t } = useTranslation();
  const format = useFormatSize();
  const picked = useSelectionStore((state) => state.picked);
  const bytes = items.reduce((sum, item) => (picked.has(item.id) ? sum + item.bytes : sum), 0);
  const all = items.length > 0 && picked.size >= items.length;

  return (
    <div className="flex min-w-0 items-center gap-2">
      {picked.size > 0 && (
        <span className="hidden truncate text-[12px] font-semibold tabular-nums text-ink-70 @min-[560px]:inline">
          {t('chat.storage.picked', { count: picked.size })} · {format(bytes)}
        </span>
      )}
      <button
        type="button"
        disabled={items.length === 0}
        onClick={() => {
          const selection = useSelectionStore.getState();
          if (all) selection.clear();
          else selection.pickAll(items.map((item) => item.id));
        }}
        className={`${CHIP} bg-ink/[0.05] text-ink-70 hover:bg-ink/[0.09] disabled:cursor-default disabled:opacity-40`}
      >
        {all ? t('chat.storage.select.clear') : t('chat.storage.select.all')}
      </button>
      <button
        type="button"
        disabled={picked.size === 0}
        onClick={onDelete}
        className={`${CHIP} bg-bad/[0.12] text-bad hover:bg-bad/[0.18] disabled:cursor-default disabled:bg-ink/[0.04] disabled:text-ink-35`}
      >
        <Trash2 size={13} />
        {picked.size > 0
          ? t('chat.storage.delete.some', { count: picked.size })
          : t('chat.storage.delete.action')}
        <span className="hidden @min-[720px]:inline-flex">
          <KeyCap size="sm">Del</KeyCap>
        </span>
      </button>
    </div>
  );
}

export const GridToolbar = memo(function GridToolbar({
  items,
  onDelete,
}: {
  items: MyMedia[];
  onDelete: () => void;
}) {
  const blur = usePerfMode().blur(18);
  return (
    <div
      data-ui="chat-storage-toolbar"
      className="@container sticky top-2 z-20 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink/[0.06] px-2 py-1.5"
      style={{
        background: blur > 0 ? 'rgb(var(--paper) / 0.72)' : 'rgb(var(--surface) / 0.97)',
        backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
        WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <OrderSwitch />
        <OriginChip />
      </div>
      <SelectionBar items={items} onDelete={onDelete} />
    </div>
  );
});
