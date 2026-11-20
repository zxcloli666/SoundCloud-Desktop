import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/shallow';
import { MapPin } from '../../lib/icons';
import { useSettingsStore } from '../../stores/settings';

export function PinLikesButton() {
  const { t } = useTranslation();
  const { pinned, setPinned } = useSettingsStore(
    useShallow((s) => ({ pinned: s.pinnedLikes, setPinned: s.setPinnedLikes })),
  );
  const label = pinned ? t('sidebar.unpinLikes') : t('sidebar.pinLikes');

  const toggle = () => {
    setPinned(!pinned);
    toast.success(t(pinned ? 'sidebar.unpinned' : 'sidebar.pinned'));
  };

  return (
    <button
      type="button"
      onClick={toggle}
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
