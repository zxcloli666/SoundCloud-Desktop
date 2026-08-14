import { useTranslation } from 'react-i18next';
import { Headphones } from '../../../lib/icons';
import { useSettingsStore } from '../../../stores/settings';
import { Card, Row, Toggle } from '../primitives';

export function PlaybackCard() {
  const { t } = useTranslation();
  const lyricsVisualizer = useSettingsStore((s) => s.lyricsVisualizer);
  const setLyricsVisualizer = useSettingsStore((s) => s.setLyricsVisualizer);
  const normalizeVolume = useSettingsStore((s) => s.normalizeVolume);
  const setNormalizeVolume = useSettingsStore((s) => s.setNormalizeVolume);
  const highQualityStreaming = useSettingsStore((s) => s.highQualityStreaming);
  const setHighQualityStreaming = useSettingsStore((s) => s.setHighQualityStreaming);

  return (
    <Card title={t('settings.playback')} icon={<Headphones size={17} />}>
      <div className="divide-y divide-white/[0.05]">
        <Row title={t('settings.lyricsVisualizer')} desc={t('settings.lyricsVisualizerDesc')}>
          <Toggle
            checked={lyricsVisualizer}
            onChange={() => setLyricsVisualizer(!lyricsVisualizer)}
          />
        </Row>
        <Row title={t('settings.normalizeVolume')} desc={t('settings.normalizeVolumeDesc')}>
          <Toggle checked={normalizeVolume} onChange={() => setNormalizeVolume(!normalizeVolume)} />
        </Row>
        <Row
          title={t('settings.highQualityStreaming')}
          desc={t('settings.highQualityStreamingDesc')}
        >
          <Toggle
            checked={highQualityStreaming}
            onChange={() => setHighQualityStreaming(!highQualityStreaming)}
          />
        </Row>
      </div>
    </Card>
  );
}
