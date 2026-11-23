import { useTranslation } from 'react-i18next';
import { MapPin } from '../../lib/icons';
import type { LayoutId } from '../../lib/layout';
import { useLayout, useToggleLayoutEntry } from '../../lib/use-layout';

export function PinQuickButton({ id }: { id: LayoutId<'quick'> }) {
  const { t } = useTranslation();
  const pinned = useLayout('quick').some((entry) => entry.id === id && !entry.hidden);
  const toggle = useToggleLayoutEntry('quick');
  const label = pinned ? t('sidebar.unpin') : t('sidebar.pin');

  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      title={label}
      aria-label={label}
      aria-pressed={pinned}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border-[0.5px] transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
        pinned
          ? 'text-accent bg-accent/15 border-accent/30'
          : 'text-ink-60 bg-ink/[0.04] border-ink/[0.08] hover:text-ink-95 hover:bg-ink/[0.07]'
      }`}
    >
      <MapPin size={16} />
    </button>
  );
}
