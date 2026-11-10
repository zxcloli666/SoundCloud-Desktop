import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Waves } from '../../../lib/icons';
import { usePremium } from '../../../lib/premium-cache';
import { useEffectsStore } from '../../../stores/effects';
import { EffectsPanel } from './EffectsPanel';

export const EffectsBtn = memo(function EffectsBtn({
  className,
}: {
  className: (active: boolean) => string;
}) {
  const { t } = useTranslation();
  const premium = usePremium();
  const enabled = useEffectsStore((s) => s.enabled);
  const preset = useEffectsStore((s) => s.preset);
  const active = enabled && premium && preset !== 'off';

  return (
    <EffectsPanel>
      <button
        type="button"
        data-ui="player-effects"
        title={t('effects.title')}
        aria-label={t('effects.title')}
        className={`relative ${className(active)}`}
      >
        <Waves size={16} />
        {active && (
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-accent px-1 text-[7.5px] font-bold uppercase leading-[11px] tracking-wide text-accent-contrast shadow-[0_0_8px_var(--color-accent-glow)]">
            {t(`effects.short.${preset}`)}
          </span>
        )}
      </button>
    </EffectsPanel>
  );
});
