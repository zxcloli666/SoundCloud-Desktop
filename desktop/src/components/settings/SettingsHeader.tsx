import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from '../../lib/icons';
import type { SettingsCategory, SettingsPage } from './registry';

function Head({
  icon,
  title,
  summary,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  summary?: string;
  trailing?: ReactNode;
}) {
  return (
    <header data-ui="settings-header" className="mb-6 flex items-center gap-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border border-[color:var(--set-line)] bg-[var(--set-panel)] text-[var(--color-accent)] [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[24px] font-semibold leading-tight tracking-[-0.015em] text-ink">
          {title}
        </h1>
        {summary && <p className="mt-0.5 truncate text-[13px] text-ink-45">{summary}</p>}
      </div>
      {trailing}
    </header>
  );
}

export function CategoryHeader({ category }: { category: SettingsCategory }) {
  const { t } = useTranslation();
  return (
    <Head icon={category.icon} title={t(category.labelKey)} summary={t(category.summaryKey)} />
  );
}

export function SearchHeader({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <Head
      icon={<Search size={18} />}
      title={t('settings.search')}
      trailing={
        <span
          data-ui="settings-search-count"
          className="set-chip h-7 min-w-7 justify-center px-2.5 text-[12.5px]"
        >
          {count}
        </span>
      }
    />
  );
}

export function PageTabs({
  pages,
  active,
  onChange,
}: {
  pages: SettingsPage[];
  active: string;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div data-ui="settings-tabs" role="tablist" className="set-tabs mb-5">
      {pages.map((page) => (
        <button
          key={page.id}
          type="button"
          role="tab"
          data-ui="settings-tab"
          aria-selected={page.id === active}
          onClick={() => onChange(page.id)}
          className="set-tab"
        >
          {page.icon}
          {t(page.labelKey)}
        </button>
      ))}
    </div>
  );
}
