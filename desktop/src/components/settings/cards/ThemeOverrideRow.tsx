import { useTranslation } from 'react-i18next';
import { Palette } from '../../../lib/icons';
import { useThemesStore } from '../../../stores/themes';

export function ThemeOverrideRow({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-accent-glow)] bg-ink/[0.03] px-4 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-ink-65">
        <Palette size={14} className="shrink-0 text-[var(--color-accent)]" />
        <span className="truncate">{label}</span>
      </span>
      <button
        type="button"
        onClick={() => void useThemesStore.getState().setEnabled(false)}
        className="shrink-0 rounded-lg bg-ink/[0.06] px-3 py-1.5 text-[12px] font-semibold text-ink-70 hover:bg-ink/[0.1] hover:text-ink transition-all cursor-pointer"
      >
        {t('settings.themesDisable')}
      </button>
    </div>
  );
}
