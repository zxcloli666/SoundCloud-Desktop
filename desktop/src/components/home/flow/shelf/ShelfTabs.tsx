import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from '../../../../lib/icons';
import { type HomeShelfTab, useSettingsStore } from '../../../../stores/settings';

const TABS: Array<{ id: HomeShelfTab; label: string }> = [
  { id: 'liked', label: 'library.likedTracks' },
  { id: 'artists', label: 'library.artists' },
  { id: 'playlists', label: 'library.likedPlaylists' },
  { id: 'history', label: 'library.history' },
];

export function ShelfTabs() {
  const { t } = useTranslation();
  const tab = useSettingsStore((s) => s.homeShelfTab);
  const setTab = useSettingsStore((s) => s.setHomeShelfTab);
  const open = useSettingsStore((s) => s.homeShelfOpen);
  const setOpen = useSettingsStore((s) => s.setHomeShelfOpen);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <div className="flex items-center gap-1.5 px-1">
      <div role="tablist" className="flex flex-wrap items-center gap-1.5">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            data-ui="shelf-tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setOpen(true);
            }}
            className={`h-8 cursor-pointer rounded-full px-3.5 text-[12px] font-semibold transition-colors ${
              tab === id && open
                ? 'bg-ink text-paper'
                : 'text-ink-50 hover:bg-ink/[0.07] hover:text-ink'
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <button
        type="button"
        data-ui="shelf-toggle"
        aria-expanded={open}
        aria-label={open ? t('flowRedesign.collapse') : t('flowRedesign.expand')}
        title={open ? t('flowRedesign.collapse') : t('flowRedesign.expand')}
        onClick={() => setOpen(!open)}
        className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-50 transition-colors hover:bg-ink/[0.07] hover:text-ink"
      >
        <Chevron size={16} aria-hidden />
      </button>
    </div>
  );
}
