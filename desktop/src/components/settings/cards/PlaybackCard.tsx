import { useTranslation } from 'react-i18next';
import { Play } from '../../../lib/icons';
import { useSubscription } from '../../../lib/subscription';
import { useAuthStore } from '../../../stores/auth';
import { useSettingsStore } from '../../../stores/settings';
import { Card, Row, Toggle } from '../primitives';
import { SearchPlaybackPicker } from './SearchPlaybackPicker';
import { SkipStuckPicker } from './SkipStuckPicker';

export function PlaybackCard() {
  const { t } = useTranslation();
  const autoplay = useSettingsStore((s) => s.autoplay);
  const setAutoplay = useSettingsStore((s) => s.setAutoplay);
  const hoverPreviewDuringPlayback = useSettingsStore((s) => s.hoverPreviewDuringPlayback);
  const setHoverPreviewDuringPlayback = useSettingsStore((s) => s.setHoverPreviewDuringPlayback);
  const playAltUploads = useSettingsStore((s) => s.playAltUploads);
  const setPlayAltUploads = useSettingsStore((s) => s.setPlayAltUploads);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: isPremium } = useSubscription(isAuthenticated);

  return (
    <Card title={t('settings.playback')} icon={<Play size={17} />}>
      <Row title={t('settings.autoplay')} desc={t('settings.autoplayDesc')}>
        <Toggle checked={autoplay} onChange={() => setAutoplay(!autoplay)} />
      </Row>
      <SearchPlaybackPicker />
      <SkipStuckPicker />
      {!isPremium && (
        <Row title={t('settings.altUploads')} info={t('settings.altUploadsDesc')}>
          <Toggle checked={playAltUploads} onChange={() => setPlayAltUploads(!playAltUploads)} />
        </Row>
      )}
      <Row
        title={t('settings.hoverPreviewDuringPlayback')}
        info={t('settings.hoverPreviewDuringPlaybackDesc')}
      >
        <Toggle
          checked={hoverPreviewDuringPlayback}
          onChange={() => setHoverPreviewDuringPlayback(!hoverPreviewDuringPlayback)}
        />
      </Row>
    </Card>
  );
}
