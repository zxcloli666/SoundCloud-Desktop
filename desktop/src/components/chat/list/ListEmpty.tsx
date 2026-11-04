import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, CheckCheck, MessagesSquare, UserPlus, Users } from '../../../lib/chat/icons';
import type { ListFilter } from '../../../lib/chat/types';
import { RefreshCw, Search, User } from '../../../lib/icons';
import { Skeleton } from '../../ui/Skeleton';
import { openNewChat } from '../new-chat/new-chat-store';

const ICONS: Record<ListFilter | 'search', typeof Users> = {
  all: MessagesSquare,
  direct: User,
  groups: Users,
  unread: CheckCheck,
  requests: UserPlus,
  archived: Archive,
  search: Search,
};

export function ListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1 px-4 pt-2">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex h-[60px] items-center gap-3">
          <Skeleton rounded="full" className="size-11 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[13px] text-ink-50">{t('chat.list.failed')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-ink/[0.08] bg-ink/[0.06] px-3.5 py-1.5 text-[12px] font-semibold text-ink-75 transition-colors hover:bg-ink/[0.1]"
      >
        <RefreshCw size={12} />
        {t('chat.list.retry')}
      </button>
    </div>
  );
}

export const ListEmpty = memo(function ListEmpty({ kind }: { kind: ListFilter | 'search' }) {
  const { t } = useTranslation();
  const Icon = ICONS[kind];
  const offerNew = kind === 'all' || kind === 'direct' || kind === 'groups';
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-[1.25rem] border border-ink/[0.07] bg-ink/[0.04] text-ink-40">
        <Icon size={22} strokeWidth={1.7} />
      </div>
      <p className="text-[13px] font-medium text-ink-55">{t(`chat.list.empty.${kind}`)}</p>
      {offerNew && (
        <button
          type="button"
          onClick={openNewChat}
          className="cursor-pointer rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]"
          style={{
            color: 'var(--color-accent-contrast)',
            background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
          }}
        >
          {t('chat.list.newChat')}
        </button>
      )}
    </div>
  );
});
