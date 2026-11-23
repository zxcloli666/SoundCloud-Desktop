import { useTranslation } from 'react-i18next';
import { useTrayAvailable } from '../../../lib/close-action';
import { X } from '../../../lib/icons';
import { type CloseAction, useSettingsStore } from '../../../stores/settings';
import { Card, Segmented } from '../primitives';
import { Notice } from './Notice';

const OPTIONS: Array<{ id: CloseAction; labelKey: string }> = [
  { id: 'tray', labelKey: 'settings.closeToTray' },
  { id: 'quit', labelKey: 'settings.closeQuit' },
];

export function CloseButtonCard() {
  const { t } = useTranslation();
  const closeAction = useSettingsStore((s) => s.closeAction);
  const setCloseAction = useSettingsStore((s) => s.setCloseAction);
  const trayAvailable = useTrayAvailable();

  return (
    <Card
      title={t('settings.closeButton')}
      desc={t('settings.closeButtonDesc')}
      info={
        trayAvailable
          ? t(closeAction === 'tray' ? 'settings.closeToTrayHint' : 'settings.closeQuitHint')
          : undefined
      }
      icon={<X size={17} />}
      action={
        <Segmented
          value={closeAction}
          onChange={setCloseAction}
          options={OPTIONS.map((o) => ({ id: o.id, label: t(o.labelKey) }))}
        />
      }
    >
      {!trayAvailable && <Notice>{t('settings.closeNoTray')}</Notice>}
    </Card>
  );
}
