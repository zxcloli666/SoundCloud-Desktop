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
      icon={<Radio size={17} />}
      action={<Toggle checked={enabled} onChange={() => setEnabled(!enabled)} />}
    >
      {enabled ? (
        <div className="space-y-3">
          <OverlayPanel />
          <TextFilePanel />
          <p className="text-[11.5px] leading-snug text-white/30">{t('settings.obsPrivacy')}</p>
        </div>
      ) : (
        <p className="text-[11.5px] leading-snug text-white/35">{t('settings.obsIntro')}</p>
      )}
    </Card>
  );
}
