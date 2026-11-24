import { useTranslation } from 'react-i18next';
import { Bookmark, RotateCcw } from '../../lib/icons';
import { resetSound } from '../../lib/sound/reset';
import { useSoundTokens } from '../../lib/sound/use-live';
import { forgetTrackSound, rememberTrackSound } from '../../lib/track-sound';
import { usePlayerStore } from '../../stores/player';
import { useTrackSoundStore } from '../../stores/track-sound';
import { QualityChips } from '../layout/player/reactions';
import { chip, ICON_BTN } from './styles';

const KEPT = new Set(['sleep', 'loop']);

function Remember() {
  const { t } = useTranslation();
  const urn = usePlayerStore((s) => s.currentTrack?.urn ?? null);
  const on = useTrackSoundStore((s) => (urn ? urn in s.overrides : false));
  if (!urn) return null;
  return (
    <button
      type="button"
      data-ui="sound-remember"
      aria-pressed={on}
      title={t(on ? 'trackSound.hintOn' : 'trackSound.hintOff')}
      onClick={() => (on ? forgetTrackSound(urn) : rememberTrackSound(urn))}
      className={chip(on)}
    >
      <Bookmark size={12} fill={on ? 'currentColor' : 'none'} />
      {t('trackSound.remember')}
    </button>
  );
}

export function SoundHead() {
  const { t } = useTranslation();
  const changed = useSoundTokens().some((token) => !KEPT.has(token.id));
  return (
    <div className="flex items-center gap-2.5">
      <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{t('sound.title')}</h3>
      <div className="flex items-center gap-1.5">
        <QualityChips />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {changed && (
          <button
            type="button"
            data-ui="sound-reset"
            onClick={resetSound}
            title={t('sound.reset')}
            aria-label={t('sound.reset')}
            className={ICON_BTN}
          >
            <RotateCcw size={14} />
          </button>
        )}
        <Remember />
      </div>
    </div>
  );
}
