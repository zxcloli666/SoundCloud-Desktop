import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, X } from '../../../lib/icons';
import { openNewChat } from '../new-chat/new-chat-store';
import { StorageButton } from './StorageButton';
import type { ListVariant } from './useRowMenu';

interface ListHeaderProps {
  variant: ListVariant;
  query: string;
  onQuery: (query: string) => void;
}

function NewChatButton({ big }: { big: boolean }) {
  const { t } = useTranslation();
  const size = big ? 'size-9' : 'size-8';
  return (
    <button
      type="button"
      onClick={openNewChat}
      title={t('chat.list.newChat')}
      aria-label={t('chat.list.newChat')}
      className={`${size} flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform duration-200 hover:scale-[1.06] active:scale-[0.94]`}
      style={{
        color: 'var(--color-accent-contrast)',
        background: 'linear-gradient(160deg, var(--color-accent-hover), var(--color-accent))',
        boxShadow: '0 6px 18px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.25)',
      }}
    >
      <Plus size={big ? 18 : 16} strokeWidth={2.4} />
    </button>
  );
}

export const ListHeader = memo(function ListHeader({ variant, query, onQuery }: ListHeaderProps) {
  const { t } = useTranslation();
  const page = variant === 'page';

  const search = (
    <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-ink/[0.06] bg-ink/[0.04] px-3 transition-colors focus-within:border-ink/[0.14] focus-within:bg-ink/[0.06]">
      <Search size={14} className="shrink-0 text-ink-35" />
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && query) {
            event.stopPropagation();
            onQuery('');
          }
        }}
        placeholder={t('chat.list.search')}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-90 outline-none placeholder:text-ink-30"
      />
      {query && (
        <button
          type="button"
          onClick={() => onQuery('')}
          aria-label={t('chat.list.clear')}
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-40 hover:bg-ink/[0.08] hover:text-ink-80"
        >
          <X size={11} />
        </button>
      )}
    </label>
  );

  if (!page) {
    return (
      <div className="flex items-center gap-2 px-3 pt-1 pb-2.5">
        {search}
        <StorageButton big={false} />
        <NewChatButton big={false} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-black tracking-tight text-ink-92">
          {t('chat.list.title')}
        </h1>
        <div className="flex items-center gap-2">
          <StorageButton big />
          <NewChatButton big />
        </div>
      </div>
      {search}
    </div>
  );
});
