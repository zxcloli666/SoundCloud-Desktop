import { useTranslation } from 'react-i18next';
import { Wifi, WifiOff } from '../../lib/icons';
import { setOfflineMode } from '../../lib/offline-mode';
import { useAppStatusStore } from '../../stores/app-status';
import { IconBox, Label, ROW } from './SidebarChrome';

export function OfflineToggle({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const on = useAppStatusStore((s) => s.offlineMode);
  const Icon = on ? WifiOff : Wifi;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-ui="offline-toggle"
      data-active={on ? 'true' : 'false'}
      onClick={() => void setOfflineMode(!on)}
      title={collapsed ? t('settings.offlineMode') : undefined}
      className={`${ROW} cursor-pointer ${
        on
          ? 'text-ink-85 bg-accent/[0.08] ring-1 ring-accent/20 hover:text-ink'
          : 'text-ink-45 hover:text-ink-80 hover:bg-ink/[0.05]'
      }`}
    >
      <IconBox>
        <Icon size={17} strokeWidth={1.9} className={on ? 'text-accent' : undefined} />
      </IconBox>
      <Label collapsed={collapsed} className="text-[12.5px] font-medium pr-3">
        {t('settings.offlineMode')}
      </Label>
      {on && (
        <span
          className={`absolute rounded-full bg-accent shadow-[0_0_8px_var(--color-accent-glow)] ${
            collapsed ? 'right-2 top-1.5 size-2' : 'right-2.5 top-1/2 size-1.5 -translate-y-1/2'
          }`}
        />
      )}
    </button>
  );
}
