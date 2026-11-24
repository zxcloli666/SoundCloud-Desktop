import { useTranslation } from 'react-i18next';
import { Loader2 } from '../../lib/icons';
import { isFinal } from '../../lib/mobile-link/flow';
import { mobileLink, useMobileLinkState } from '../../stores/mobile-link';

export function MobileLinkIsland() {
  const { t } = useTranslation();
  const { active, phase, dialogOpen, minutes } = useMobileLinkState();

  if (!active || isFinal(phase) || dialogOpen) return null;

  return (
    <div className="fixed bottom-[calc(var(--dock-height)+45px)] left-1/2 z-[70] -translate-x-1/2 animate-fade-in-up motion-reduce:animate-none">
      <button
        type="button"
        data-ui="mobile-link-island"
        onClick={() => mobileLink.openDialog()}
        className="flex max-w-[92vw] cursor-pointer items-center gap-2.5 rounded-full border border-ink/[0.14] bg-surface/90 py-2 pr-4 pl-3 text-[12px] shadow-[0_12px_36px_rgb(var(--shade)/calc(0.3*var(--shade-alpha)))] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <Loader2 size={14} className="animate-spin text-accent motion-reduce:animate-none" />
        <span className="font-semibold text-ink-85">{t('mobileLink.state.waiting')}</span>
        <span className="truncate text-ink-45">
          {t('mobileLink.hint.minutes', { count: minutes })}
        </span>
      </button>
    </div>
  );
}
