import { useTranslation } from 'react-i18next';
import { Search } from '../../../lib/icons';

export function SearchEmpty({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      data-ui="settings-search-empty"
      className="flex flex-col items-center gap-4 px-6 py-14 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--set-well)] text-ink-40">
        <Search size={20} />
      </span>
      <p className="text-[14px] font-medium text-ink-60">{t('settings.searchEmpty')}</p>
      <button type="button" onClick={onClear} className="set-btn">
        {t('settings.searchClear')}
      </button>
    </div>
  );
}
