import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { toggleEffects } from '../../lib/effects';
import { usePremium } from '../../lib/premium-cache';
import { useEffectsStore } from '../../stores/effects';
import { toggleSection } from '../../stores/sound-window';
import { EffectsManual } from '../music/effects/EffectsManual';
import { Toggle } from '../settings/primitives';
import { EffectTiles } from './EffectTiles';
import { ExpandBtn } from './ExpandBtn';
import { LiveEffect } from './LiveEffect';
import { LABEL } from './styles';

export const EffectsSection = memo(function EffectsSection({ full }: { full: boolean }) {
  const { t } = useTranslation();
  const locked = !usePremium();
  const enabled = useEffectsStore((s) => s.enabled);

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
      <div className="flex h-7 items-center gap-1.5">
        <span className={LABEL}>{t('effects.title')}</span>
        <ExpandBtn full={full} onClick={() => toggleSection('effects')} />
        <span className="flex-1" />
        {full && (
          <Toggle
            checked={enabled && !locked}
            onChange={toggleEffects}
            disabled={locked}
            label={t('effects.toggle')}
          />
        )}
      </div>
      {full && <LiveEffect locked={locked} />}
      <EffectTiles locked={locked} full={full} />
      {full && <EffectsManual locked={locked} />}
    </div>
  );
});
