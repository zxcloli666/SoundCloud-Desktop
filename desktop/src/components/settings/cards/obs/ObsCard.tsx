import { useTranslation } from 'react-i18next';
import { Radio } from '../../../../lib/icons';
import { useSettingsStore } from '../../../../stores/settings';
import { Card, Toggle } from '../../primitives';
import { OverlayPanel } from './OverlayPanel';
import { TextFilePanel } from './TextFilePanel';

export function ObsCard() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.obsEnabled);
  const setEnabled = useSettingsStore((s) => s.setObsEnabled);

  return (
    <Card
      title={t('settings.obs')}
      desc={t('settings.obsDesc')}
      info={enabled ? t('settings.obsPrivacy') : undefined}
      icon={<Radio size={17} />}
      action={
        <Toggle checked={enabled} onChange={() => setEnabled(!enabled)} label={t('settings.obs')} />
      }
    >
      {enabled ? (
        <div className="space-y-2.5">
          <OverlayPanel />
          <TextFilePanel />
        </div>
      ) : (
        <p className="text-[12.5px] leading-snug text-ink-50">{t('settings.obsIntro')}</p>
      )}
    </Card>
  );
}
