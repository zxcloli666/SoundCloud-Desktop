import { useTranslation } from 'react-i18next';
import { Lock } from '../../lib/icons';
import { closeSound } from '../../stores/sound-window';
import { StarCta } from '../star-moments/StarCta';

export function LockedBanner() {
  const { t } = useTranslation();
  return (
    <div
      data-ui="sound-locked"
      className="absolute inset-x-3 top-1/2 mx-auto flex w-fit -translate-y-1/2 items-center gap-2.5 rounded-full border border-accent/30 bg-surface-hi/90 py-1.5 pl-3.5 pr-1.5"
    >
      <Lock size={13} className="shrink-0 text-accent" />
      <p className="min-w-0 text-[12px] font-semibold text-ink-85">{t('effects.locked')}</p>
      <StarCta size="sm" onOpen={closeSound} />
    </div>
  );
}
