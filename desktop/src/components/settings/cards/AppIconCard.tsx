import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { appIconUrl } from '../../../lib/app-icon';
import { APP_ICONS, type AppIconId } from '../../../lib/app-icons';
import { ImageIcon } from '../../../lib/icons';
import { isMac } from '../../../lib/platform';
import { useSettingsStore } from '../../../stores/settings';
import { Block, Card } from '../primitives';

export function AppIconCard() {
  const { t } = useTranslation();
  const appIcon = useSettingsStore((s) => s.appIcon);
  const setAppIcon = useSettingsStore((s) => s.setAppIcon);

  return (
    <Card
      title={t('settings.appIcon')}
      desc={t('settings.appIconDesc')}
      info={isMac() ? t('settings.appIconDock') : undefined}
      icon={<ImageIcon size={17} />}
      action={
        <span className="text-[12.5px] text-ink-60">{t(`settings.appIcons.${appIcon}`)}</span>
      }
    >
      <Block>
        <div
          role="radiogroup"
          aria-label={t('settings.appIcon')}
          data-ui="app-icons"
          className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-3"
        >
          {APP_ICONS.map((id) => (
            <AppIconTile
              key={id}
              id={id}
              name={t(`settings.appIcons.${id}`)}
              active={id === appIcon}
              onPick={setAppIcon}
            />
          ))}
        </div>
      </Block>
    </Card>
  );
}

const AppIconTile = memo(function AppIconTile({
  id,
  name,
  active,
  onPick,
}: {
  id: AppIconId;
  name: string;
  active: boolean;
  onPick: (id: AppIconId) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={name}
      title={name}
      data-ui="app-icon"
      onClick={() => onPick(id)}
      className={`group flex cursor-pointer items-center justify-center rounded-[20px] p-1.5 outline-none ring-2 transition-shadow duration-150 focus-visible:ring-ink/40 ${
        active ? 'ring-accent' : 'ring-transparent hover:ring-ink/10'
      }`}
    >
      <img
        src={appIconUrl(id)}
        alt=""
        draggable={false}
        decoding="async"
        className={`aspect-square w-full max-w-[72px] transition-transform duration-200 ${
          active ? '' : 'group-hover:scale-105'
        } ${id === 'classic' ? 'rounded-[24%]' : ''}`}
      />
    </button>
  );
});
