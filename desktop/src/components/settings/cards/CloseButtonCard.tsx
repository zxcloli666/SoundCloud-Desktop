import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCloseBehavior } from '../../../lib/close-action';
import { AlertCircle, X } from '../../../lib/icons';
import { type CloseAction, useSettingsStore } from '../../../stores/settings';
import { Card, Segmented } from '../primitives';

const OPTIONS: Array<{ id: CloseAction; labelKey: string }> = [
  { id: 'tray', labelKey: 'settings.closeToTray' },
  { id: 'quit', labelKey: 'settings.closeQuit' },
];

export function CloseButtonCard() {
  const { t } = useTranslation();
  const closeAction = useSettingsStore((s) => s.closeAction);
  const setCloseAction = useSettingsStore((s) => s.setCloseAction);
  const [trayAvailable, setTrayAvailable] = useState(true);

  useEffect(() => {
    getCloseBehavior()
      .then((behavior) => setTrayAvailable(behavior.trayAvailable))
      .catch(() => setTrayAvailable(true));
  }, []);

  return (
    <Card
      title={t('settings.closeButton')}
      desc={t('settings.closeButtonDesc')}
      icon={<X size={17} />}
    >
      <Segmented
        value={closeAction}
        onChange={setCloseAction}
        options={OPTIONS.map((o) => ({ id: o.id, label: t(o.labelKey) }))}
      />
      {trayAvailable ? (
        <p className="mt-3 px-1 text-[11.5px] leading-snug text-white/40">
          {t(closeAction === 'tray' ? 'settings.closeToTrayHint' : 'settings.closeQuitHint')}
        </p>
      ) : (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] px-3.5 py-2.5">
          <AlertCircle size={14} className="shrink-0 mt-px text-amber-300/90" />
          <p className="min-w-0 text-[11.5px] leading-snug text-white/60">
            {t('settings.closeNoTray')}
          </p>
        </div>
      )}
    </Card>
  );
}
