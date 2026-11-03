import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, UserPlus } from '../../../lib/chat/icons';
import { ink } from '../../../lib/chat/tone';
import type { ListFilter } from '../../../lib/chat/types';
import { useChatStore } from '../../../stores/chat';
import { useChatListStore } from '../../../stores/chat/list';
import { ChipScroller } from './ChipScroller';
import { unreadLabel } from './mute';

const KINDS: ListFilter[] = ['all', 'direct', 'groups', 'unread'];

const ACTIVE = {
  background: `linear-gradient(180deg, var(--color-chat-tint), transparent), ${ink(6)}`,
  borderColor: 'var(--color-chat-tint)',
  color: 'var(--color-white)',
};

function Chip({
  id,
  active,
  label,
  onClick,
  children,
}: {
  id: ListFilter;
  active: boolean;
  label?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-ui="chat-filter"
      data-kind={id}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold whitespace-nowrap transition-colors duration-200 ${
        active
          ? ''
          : 'border-ink/[0.06] bg-ink/[0.03] text-ink-50 hover:bg-ink/[0.07] hover:text-ink-80'
      }`}
      style={active ? ACTIVE : undefined}
    >
      {children}
    </button>
  );
}

function Count({ value, loud }: { value: number; loud: boolean }) {
  if (value <= 0) return null;
  return (
    <span
      className={`rounded-full px-1.5 text-[10.5px] font-bold tabular-nums leading-[16px] ${
        loud ? 'bg-[var(--color-accent)] text-[var(--color-accent-contrast)]' : 'bg-ink/10'
      }`}
    >
      {unreadLabel(value)}
    </span>
  );
}

export const FilterChips = memo(function FilterChips() {
  const { t } = useTranslation();
  const filter = useChatListStore((state) => state.filter);
  const setFilter = useChatListStore((state) => state.setFilter);
  const requests = useChatListStore((state) => state.requests);
  const unread = useChatStore((state) => state.status?.unread ?? 0);
  const toggle = (id: ListFilter) => setFilter(filter === id ? 'all' : id);

  return (
    <div className="flex items-center gap-1.5 px-3 pb-2">
      <ChipScroller active={filter}>
        {KINDS.map((id) => (
          <Chip key={id} id={id} active={filter === id} onClick={() => setFilter(id)}>
            {t(`chat.list.filters.${id}`)}
            <Count value={id === 'unread' ? unread : 0} loud={false} />
          </Chip>
        ))}
      </ChipScroller>
      <Chip
        id="requests"
        active={filter === 'requests'}
        label={t('chat.list.filters.requests')}
        onClick={() => toggle('requests')}
      >
        <UserPlus size={13} className="-mx-0.5" />
        <Count value={requests} loud={filter !== 'requests'} />
      </Chip>
      <Chip
        id="archived"
        active={filter === 'archived'}
        label={t('chat.list.filters.archived')}
        onClick={() => toggle('archived')}
      >
        <Archive size={13} className="-mx-0.5" />
      </Chip>
    </div>
  );
});
