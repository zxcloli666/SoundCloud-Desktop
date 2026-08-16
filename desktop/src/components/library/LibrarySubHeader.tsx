import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { fc } from '../../lib/formatters';
import { Search as SearchIcon, X } from '../../lib/icons';
import { type LibraryTab, LibraryTabs } from './LibraryTabs';

interface LibrarySubHeaderProps {
  title: string;
  activeTab?: LibraryTab;
  count?: number;
  filter?: string;
  onFilter?: (value: string) => void;
}

export const LibrarySubHeader = memo(function LibrarySubHeader({
  title,
  activeTab,
  count,
  filter,
  onFilter,
}: LibrarySubHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="sonveil-library-header">
      <div className="sonveil-library-heading-row">
        <div className="min-w-0">
          <h1>{title}</h1>
          {count != null && count > 0 ? <p>{fc(count)}</p> : null}
        </div>

        {onFilter ? (
          <div className="sonveil-library-filter">
            <SearchIcon size={15} aria-hidden="true" />
            <input
              type="text"
              value={filter ?? ''}
              onChange={(event) => onFilter(event.target.value)}
              placeholder={t('library.filter')}
            />
            {filter ? (
              <button type="button" onClick={() => onFilter('')} aria-label={t('common.close')}>
                <X size={14} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <LibraryTabs active={activeTab} />
    </header>
  );
});
