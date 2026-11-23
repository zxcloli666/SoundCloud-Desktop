import { useTranslation } from 'react-i18next';
import { type SkipStuckAfterSec, useSettingsStore } from '../../../stores/settings';
import { Row, Segmented } from '../primitives';

const OPTIONS: SkipStuckAfterSec[] = [0, 10, 20, 30, 60];

export function SkipStuckPicker() {
  const { t } = useTranslation();
  const skipStuckAfterSec = useSettingsStore((s) => s.skipStuckAfterSec);
  const setSkipStuckAfterSec = useSettingsStore((s) => s.setSkipStuckAfterSec);

  return (
    <Row
      title={t('settings.skipStuck')}
      info={
        skipStuckAfterSec > 0
          ? t('settings.skipStuckDesc', { count: skipStuckAfterSec })
          : t('settings.skipStuckOffDesc')
      }
    >
      <Segmented
        value={String(skipStuckAfterSec)}
        onChange={(v) => setSkipStuckAfterSec(Number(v) as SkipStuckAfterSec)}
        options={OPTIONS.map((sec) => ({
          id: String(sec),
          label:
            sec > 0 ? t('settings.skipStuckSeconds', { count: sec }) : t('settings.skipStuckOff'),
        }))}
      />
    </Row>
  );
}
