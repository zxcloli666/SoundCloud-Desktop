import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from '../../../../lib/icons';
import { useReleaseFeed } from '../../../../lib/new-releases-api';
import { type HomeShelfTab, useSettingsStore } from '../../../../stores/settings';
import { ReleaseActions } from '../../../releases/ReleaseActions';

const TABS: Array<{ id: HomeShelfTab; label: string }> = [
  { id: 'liked', label: 'library.likedTracks' },
  { id: 'superliked', label: 'superlikes.title' },
  { id: 'releases', label: 'releases.title' },
  { id: 'artists', label: 'library.artists' },
  { id: 'playlists', label: 'library.likedPlaylists' },
  { id: 'history', label: 'library.history' },
];

function UnheardCount() {
  const { unheard } = useReleaseFeed();
  if (unheard <= 0) return null;
  return (
    <span
      data-ui="shelf-tab-count"
      className="pointer-events-none absolute -right-1 -top-1.5 min-w-[15px] rounded-full bg-accent px-1 text-center text-[9.5px] font-bold leading-[15px] tabular-nums text-accent-contrast"
    >
      {unheard > 99 ? '99+' : unheard}
    </span>
  );
}

function ReleaseShelfActions({ shown }: { shown: boolean }) {
  const { tracks } = useReleaseFeed();
  if (tracks.length === 0) return null;
  return (
    <div data-ui="shelf-actions" inert={!shown} className={shown ? '' : 'invisible'}>
      <ReleaseActions tracks={tracks} quiet />
    </div>
  );
}

export function ShelfTabs() {
  const { t } = useTranslation();
  const tab = useSettingsStore((s) => s.homeShelfTab);
  const setTab = useSettingsStore((s) => s.setHomeShelfTab);
  const open = useSettingsStore((s) => s.homeShelfOpen);
  const setOpen = useSettingsStore((s) => s.setHomeShelfOpen);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <div className="@container flex items-center gap-1.5 px-1">
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
            className={`relative h-7 cursor-pointer rounded-full px-3 text-[11.5px] font-semibold transition-colors ${
              tab === id && open
                ? 'bg-ink text-paper'
                : 'text-ink-50 hover:bg-ink/[0.07] hover:text-ink'
            }`}
          >
            {t(label)}
            {id === 'releases' && <UnheardCount />}
          </button>
        ))}
      </div>
      <span className="flex-1" />
      <ReleaseShelfActions shown={open && tab === 'releases'} />
      <button
        type="button"
        data-ui="shelf-toggle"
        aria-expanded={open}
        aria-label={open ? t('flowRedesign.collapse') : t('flowRedesign.expand')}
        title={open ? t('flowRedesign.collapse') : t('flowRedesign.expand')}
        onClick={() => setOpen(!open)}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-50 transition-colors hover:bg-ink/[0.07] hover:text-ink"
      >
        <Chevron size={16} aria-hidden />
      </button>
    </div>
  );
}
