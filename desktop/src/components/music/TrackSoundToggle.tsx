import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark } from '../../lib/icons';
import { forgetTrackSound, rememberTrackSound } from '../../lib/track-sound';
import { usePlayerStore } from '../../stores/player';
import { useTrackSoundStore } from '../../stores/track-sound';
import { Toggle } from '../settings/primitives';

export const TrackSoundToggle = React.memo(function TrackSoundToggle({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const urn = usePlayerStore((s) => s.currentTrack?.urn ?? null);
  const remembered = useTrackSoundStore((s) => (urn ? urn in s.overrides : false));

  const toggle = useCallback(() => {
    if (!urn) return;
    if (remembered) forgetTrackSound(urn);
    else rememberTrackSound(urn);
  }, [urn, remembered]);

  const hint = !urn
    ? t('trackSound.noTrack')
    : remembered
      ? t('trackSound.hintOn')
      : t('trackSound.hintOff');

  return (
    <div
      className={`flex items-center gap-3 border transition-colors duration-200 ${
        compact ? 'rounded-[14px] px-3 py-2.5' : 'rounded-2xl px-4 py-3'
      } ${
        remembered ? 'border-accent/25 bg-accent/[0.06]' : 'border-white/[0.06] bg-white/[0.02]'
      }`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
          compact ? 'h-7 w-7' : 'h-9 w-9'
        } ${remembered ? 'bg-accent/15 text-accent' : 'bg-white/[0.04] text-white/35'}`}
      >
        <Bookmark size={compact ? 13 : 15} fill={remembered ? 'currentColor' : 'none'} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-white/85 ${compact ? 'text-[11px]' : 'text-[13px]'}`}>
          {t('trackSound.remember')}
        </p>
        <p className={`truncate text-white/35 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {hint}
        </p>
      </div>
      <Toggle checked={remembered} onChange={toggle} disabled={!urn} />
    </div>
  );
});
