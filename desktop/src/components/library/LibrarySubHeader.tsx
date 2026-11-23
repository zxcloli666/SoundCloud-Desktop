import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fc } from '../../lib/formatters';
import { ChevronLeft, Search as SearchIcon, X } from '../../lib/icons';
import { SyncStatusChip } from '../sync/SyncStatusChip';

interface LibrarySubHeaderProps {
  title: string;
  count?: number;
  filter?: string;
  onFilter?: (v: string) => void;
  actions?: ReactNode;
}

export const LibrarySubHeader = memo(function LibrarySubHeader({
  title,
  count,
  filter,
  onFilter,
  actions,
}: LibrarySubHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="mb-6">
      <div className="mb-1 flex h-8 items-center gap-3">
        <Link
          to="/library"
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-ink-40 hover:text-ink-85 transition-colors"
        >
          <ChevronLeft size={15} />
          {t('nav.library')}
        </Link>
        <SyncStatusChip quietWhenSynced />
      </div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight text-ink md:text-[30px]">
            {title}
          </h1>
          {count != null && count > 0 && (
            <span className="text-[14px] font-medium tabular-nums text-ink-35">{fc(count)}</span>
          )}
        </div>

        {(onFilter || actions) && (
          <div className="flex items-center justify-end gap-2 flex-1 min-w-min">
            {actions}
            {onFilter && (
              <div className="relative min-w-[200px] max-w-[320px] flex-1">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <SearchIcon size={15} className="text-ink-30" />
                </div>
                <input
                  type="text"
                  value={filter ?? ''}
                  onChange={(e) => onFilter(e.target.value)}
                  placeholder={t('library.filter')}
                  className="w-full bg-ink/[0.04] hover:bg-ink/[0.06] focus:bg-ink/[0.08] text-ink-80 placeholder:text-ink-30 text-[13px] py-2.5 pl-9 pr-8 rounded-xl outline-none border border-ink/[0.05] focus:border-ink/[0.12] transition-all duration-200"
                />
                {filter && (
                  <button
                    type="button"
                    onClick={() => onFilter('')}
                    className="absolute inset-y-0 right-2 flex items-center text-ink-30 hover:text-ink-60 cursor-pointer transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
