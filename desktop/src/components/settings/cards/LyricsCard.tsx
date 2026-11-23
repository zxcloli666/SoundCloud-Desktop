import { useTranslation } from 'react-i18next';
import { MicVocal } from '../../../lib/icons';
import { type LyricsHighlight, useSettingsStore } from '../../../stores/settings';
import { Card, Row, Segmented, Toggle } from '../primitives';

const HIGHLIGHTS: ReadonlyArray<{ id: LyricsHighlight; labelKey: string }> = [
  { id: 'word', labelKey: 'settings.lyricsHighlightWord' },
  { id: 'line', labelKey: 'settings.lyricsHighlightLine' },
];

export function LyricsCard() {
  const { t } = useTranslation();
  const floatingComments = useSettingsStore((s) => s.floatingComments);
  const setFloatingComments = useSettingsStore((s) => s.setFloatingComments);
  const lyricsVisualizer = useSettingsStore((s) => s.lyricsVisualizer);
  const setLyricsVisualizer = useSettingsStore((s) => s.setLyricsVisualizer);
  const lyricsHighlight = useSettingsStore((s) => s.lyricsHighlight);
  const setLyricsHighlight = useSettingsStore((s) => s.setLyricsHighlight);
  const lightMode = useSettingsStore((s) => s.perfMode === 'light');

  return (
    <Card title={t('settings.lyricsAndComments')} icon={<MicVocal size={17} />}>
      <Row
        title={t('settings.lyricsHighlight')}
        desc={t(lightMode ? 'settings.lyricsHighlightLightDesc' : 'settings.lyricsHighlightDesc')}
      >
        <Segmented
          value={lyricsHighlight}
          onChange={setLyricsHighlight}
          options={HIGHLIGHTS.map((h) => ({ id: h.id, label: t(h.labelKey) }))}
        />
      </Row>
      <Row title={t('settings.lyricsVisualizer')} desc={t('settings.lyricsVisualizerDesc')}>
        <Toggle
          checked={lyricsVisualizer}
          onChange={() => setLyricsVisualizer(!lyricsVisualizer)}
        />
      </Row>
      <Row title={t('settings.floatingComments')} desc={t('settings.floatingCommentsDesc')}>
        <Toggle
          checked={floatingComments}
          onChange={() => setFloatingComments(!floatingComments)}
        />
      </Row>
    </Card>
  );
}
