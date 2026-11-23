import { useTranslation } from 'react-i18next';
import { type SearchPlayback, useSettingsStore } from '../../../stores/settings';
import { Row, Segmented } from '../primitives';

const OPTIONS: SearchPlayback[] = ['similar', 'results'];

export function SearchPlaybackPicker() {
  const { t } = useTranslation();
  const searchPlayback = useSettingsStore((s) => s.searchPlayback);
  const setSearchPlayback = useSettingsStore((s) => s.setSearchPlayback);

  return (
    <Row
      title={t('settings.searchPlayback')}
      info={
        searchPlayback === 'similar'
          ? t('settings.searchPlaybackSimilarDesc')
          : t('settings.searchPlaybackResultsDesc')
      }
    >
      <Segmented
        value={searchPlayback}
        onChange={setSearchPlayback}
        options={OPTIONS.map((mode) => ({
          id: mode,
          label:
            mode === 'similar'
              ? t('settings.searchPlaybackSimilar')
              : t('settings.searchPlaybackResults'),
        }))}
      />
    </Row>
  );
}
