import { useTranslation } from 'react-i18next';
import { Search } from '../../../lib/icons';

export function SearchEmpty({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      data-ui="settings-search-empty"
      className="flex flex-col items-center gap-4 px-6 py-14 text-center"
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl text-ink-40"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--ink) / 0.07), rgb(var(--ink) / 0.02))',
          border: '0.5px solid rgb(var(--ink) / 0.1)',
        }}
      >
        <Search size={22} />
      </span>
      <p className="text-[14px] font-semibold text-ink-60">{t('settings.searchEmpty')}</p>
      <button
        type="button"
        onClick={onClear}
        className="h-9 cursor-pointer rounded-full px-5 text-[12.5px] font-bold text-[var(--color-accent)] transition-colors duration-200 hover:bg-ink/[0.06]"
        style={{
          background: 'var(--color-accent-glow)',
          border: '0.5px solid var(--color-accent-glow)',
        }}
      >
        {t('settings.searchClear')}
      </button>
    </div>
  );
}
