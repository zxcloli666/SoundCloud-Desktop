import { useTranslation } from 'react-i18next';
import { RefreshCw, SlidersHorizontal } from '../../../lib/icons';
import { useSettingsStore } from '../../../stores/settings';
import { GenreFilter } from '../../music/soundwave/genre-filter';
import { HideLikedToggle } from '../../music/soundwave/hide-liked-toggle';
import { HideListenedToggle } from '../../music/soundwave/hide-listened-toggle';
import { LanguageFilter } from '../../music/soundwave/language-filter';
import { VibeButton } from './VibeButton';

const ROUND =
  'flex size-7 shrink-0 items-center justify-center rounded-full border border-ink/[0.1] bg-ink/[0.04]';

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
      className="flex flex-col gap-2.5 rounded-[14px] border border-ink/[0.09] bg-ink/[0.025] p-2.5"
    >
      <div className="flex items-center gap-2.5">
        <span className={`${ROUND} text-ink-60`} aria-hidden>
          <SlidersHorizontal size={13} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-80">
          {t('flowRedesign.waveSettings')}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={spinning}
          title={t('soundwave.refresh')}
          aria-label={t('soundwave.refresh')}
          className={`${ROUND} cursor-pointer text-ink-60 transition-colors hover:border-ink/[0.2] hover:bg-ink/[0.1] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <RefreshCw size={12} className={spinning ? 'animate-spin' : ''} aria-hidden />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <HideListenedToggle value={hideListened} onChange={setHideListened} />
        <HideLikedToggle value={hideLiked} onChange={setHideLiked} />
        <GenreFilter selected={genres} onChange={setGenres} />
        <LanguageFilter selected={languages} onChange={setLanguages} />
        <VibeButton />
      </div>
    </div>
  );
}
