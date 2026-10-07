import { useTranslation } from 'react-i18next';
import { type SearchPlayback, useSettingsStore } from '../../../stores/settings';
import { Segmented } from '../primitives';

const OPTIONS: SearchPlayback[] = ['similar', 'results'];

export function SearchPlaybackPicker() {
  const { t } = useTranslation();
  const searchPlayback = useSettingsStore((s) => s.searchPlayback);
  const setSearchPlayback = useSettingsStore((s) => s.setSearchPlayback);

  return (
    <div className="space-y-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[13.5px] text-white/80 font-medium">
          {t('settings.searchPlayback')}
        </div>
        <p className="text-[11.5px] text-white/35 mt-0.5 leading-snug">
          {searchPlayback === 'similar'
            ? t('settings.searchPlaybackSimilarDesc')
            : t('settings.searchPlaybackResultsDesc')}
        </p>
      </div>
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
    </div>
  );
}
