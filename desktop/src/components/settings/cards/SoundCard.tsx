import { useTranslation } from 'react-i18next';
import { AudioLines } from '../../../lib/icons';
import { useSubscription } from '../../../lib/subscription';
import { useAuthStore } from '../../../stores/auth';
import { useSettingsStore } from '../../../stores/settings';
import { Card, Row, Toggle } from '../primitives';
import { CrossfadePicker } from './CrossfadePicker';
import { StreamQualityPicker } from './StreamQualityPicker';

export function SoundCard() {
  const { t } = useTranslation();
  const normalizeVolume = useSettingsStore((s) => s.normalizeVolume);
  const setNormalizeVolume = useSettingsStore((s) => s.setNormalizeVolume);
  const skipSilence = useSettingsStore((s) => s.skipSilence);
  const setSkipSilence = useSettingsStore((s) => s.setSkipSilence);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: isPremium } = useSubscription(isAuthenticated);

  return (
    <Card title={t('settings.sound')} icon={<AudioLines size={17} />}>
      <StreamQualityPicker isPremium={!!isPremium} />
      <Row title={t('settings.normalizeVolume')} desc={t('settings.normalizeVolumeDesc')}>
        <Toggle checked={normalizeVolume} onChange={() => setNormalizeVolume(!normalizeVolume)} />
      </Row>
      <Row title={t('settings.skipSilence')} info={t('settings.skipSilenceDesc')}>
        <Toggle checked={skipSilence} onChange={() => setSkipSilence(!skipSilence)} />
      </Row>
      <CrossfadePicker />
    </Card>
  );
}
