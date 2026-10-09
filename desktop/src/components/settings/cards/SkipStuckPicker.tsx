import { useTranslation } from 'react-i18next';
import { type SkipStuckAfterSec, useSettingsStore } from '../../../stores/settings';
import { Segmented } from '../primitives';

const OPTIONS: SkipStuckAfterSec[] = [0, 10, 20, 30, 60];

export function SkipStuckPicker() {
  const { t } = useTranslation();
  const skipStuckAfterSec = useSettingsStore((s) => s.skipStuckAfterSec);
  const setSkipStuckAfterSec = useSettingsStore((s) => s.setSkipStuckAfterSec);

  return (
    <div className="space-y-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[13.5px] text-white/80 font-medium">{t('settings.skipStuck')}</div>
        <p className="text-[11.5px] text-white/35 mt-0.5 leading-snug">
          {skipStuckAfterSec > 0
            ? t('settings.skipStuckDesc', { count: skipStuckAfterSec })
            : t('settings.skipStuckOffDesc')}
        </p>
      </div>
      <Segmented
        value={String(skipStuckAfterSec)}
        onChange={(v) => setSkipStuckAfterSec(Number(v) as SkipStuckAfterSec)}
        options={OPTIONS.map((sec) => ({
          id: String(sec),
          label:
            sec > 0 ? t('settings.skipStuckSeconds', { count: sec }) : t('settings.skipStuckOff'),
        }))}
      />
    </div>
  );
}
