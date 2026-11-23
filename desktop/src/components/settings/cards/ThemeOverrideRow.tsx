import { useTranslation } from 'react-i18next';
import { Palette } from '../../../lib/icons';
import { useThemesStore } from '../../../stores/themes';

export function ThemeOverrideRow({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] bg-accent/[0.1] py-1.5 pr-1.5 pl-3">
      <Palette size={14} className="shrink-0 text-[var(--color-accent)]" />
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-80">{label}</span>
      <button
        type="button"
        onClick={() => void useThemesStore.getState().setEnabled(false)}
        className="set-btn h-7"
      >
        {t('settings.themesDisable')}
      </button>
    </div>
  );
}
