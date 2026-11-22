import { useTranslation } from 'react-i18next';
import { RefreshCw } from '../../../lib/icons';
import { useSettingsStore } from '../../../stores/settings';
import { GenreFilter } from '../../music/soundwave/genre-filter';
import { HideLikedToggle } from '../../music/soundwave/hide-liked-toggle';
import { HideListenedToggle } from '../../music/soundwave/hide-listened-toggle';
import { LanguageFilter } from '../../music/soundwave/language-filter';
import { VibeButton } from './VibeButton';

export function WaveSettings({
  spinning,
  onRefresh,
}: {
  spinning: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const setHideListened = useSettingsStore((s) => s.setSoundwaveHideListened);
  const hideLiked = useSettingsStore((s) => s.soundwaveHideLiked);
  const setHideLiked = useSettingsStore((s) => s.setSoundwaveHideLiked);
  const genres = useSettingsStore((s) => s.soundwaveGenres);
  const setGenres = useSettingsStore((s) => s.setSoundwaveGenres);
  const languages = useSettingsStore((s) => s.soundwaveLanguages);
  const setLanguages = useSettingsStore((s) => s.setSoundwaveLanguages);

  return (
    <div
      data-ui="wave-settings"
      role="group"
      aria-label={t('flowRedesign.waveSettings')}
      className="flex flex-wrap items-center gap-2 px-2"
    >
      <HideListenedToggle value={hideListened} onChange={setHideListened} />
      <HideLikedToggle value={hideLiked} onChange={setHideLiked} />
      <GenreFilter selected={genres} onChange={setGenres} />
      <LanguageFilter selected={languages} onChange={setLanguages} />
      <VibeButton />
      <button
        type="button"
        onClick={onRefresh}
        disabled={spinning}
        title={t('soundwave.refresh')}
        aria-label={t('soundwave.refresh')}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-ink/[0.08] bg-ink/[0.06] text-ink-70 transition-colors hover:border-ink/[0.14] hover:bg-ink/[0.1] hover:text-ink-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <RefreshCw size={13} className={spinning ? 'animate-spin' : ''} aria-hidden />
      </button>
    </div>
  );
}
