import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AudioLines,
  Bookmark,
  Clock,
  Eye,
  EyeOff,
  Heart,
  LayoutDashboard,
  ListMusic,
  Lock,
  RotateCcw,
  Sparkles,
  Users,
} from '../../../lib/icons';
import {
  isDefaultLayout,
  LAYOUT_IDS,
  type LayoutId,
  type LayoutScope,
  LOCKED_VISIBLE,
  moveEntry,
} from '../../../lib/layout';
import { useLayout } from '../../../lib/use-layout';
import { useSettingsStore } from '../../../stores/settings';
import { NAV_ITEMS } from '../../layout/nav-items';
import { Card, Segmented } from '../primitives';
import { PinnedEditor, RiverSections } from './LayoutExtras';
import { LayoutList, RowIconButton } from './LayoutList';

type ItemMeta = { icon: ReactNode; label: string };

const LIBRARY_ITEMS: Record<LayoutId<'library'>, ItemMeta> = {
  fresh: { icon: <Sparkles size={16} />, label: 'library.freshFromFollowing' },
  continue: { icon: <Clock size={16} />, label: 'library.continue' },
  playlists: { icon: <ListMusic size={16} />, label: 'library.yourPlaylists' },
  likedPlaylists: { icon: <Bookmark size={16} />, label: 'library.likedPlaylists' },
  artists: { icon: <Users size={16} />, label: 'library.artists' },
  likes: { icon: <Heart size={16} />, label: 'library.likedTracks' },
};

const HOME_ITEMS: Record<LayoutId<'home'>, ItemMeta> = {
  river: { icon: <AudioLines size={16} />, label: 'settings.layoutRiver' },
  likes: { icon: <Heart size={16} />, label: 'library.likedTracks' },
  recommended: { icon: <Sparkles size={16} />, label: 'home.recommended' },
};

function itemMeta(scope: LayoutScope, id: string): ItemMeta {
  if (scope === 'library') return LIBRARY_ITEMS[id as LayoutId<'library'>];
  if (scope === 'home') return HOME_ITEMS[id as LayoutId<'home'>];
  const nav = NAV_ITEMS[id as LayoutId<'sidebar'>];
  return { icon: <nav.icon size={16} strokeWidth={1.9} />, label: nav.label };
}

const SCOPES: Array<{ id: LayoutScope; labelKey: string }> = [
  { id: 'sidebar', labelKey: 'settings.layoutSidebar' },
  { id: 'library', labelKey: 'settings.layoutLibrary' },
  { id: 'home', labelKey: 'settings.layoutHome' },
];

function BlocksEditor({ scope }: { scope: LayoutScope }) {
  const { t } = useTranslation();
  const layout = useLayout(scope);
  const setLayout = useSettingsStore((s) => s.setLayout);

  const toggle = (id: string) =>
    setLayout(
      scope,
      layout.map((e) => (e.id === id ? { ...e, hidden: !e.hidden } : e)),
    );

  const items = layout.map((entry) => {
    const meta = itemMeta(scope, entry.id);
    const locked = LOCKED_VISIBLE.has(`${scope}:${entry.id}`);
    const offlineHint = scope === 'sidebar' && entry.id === 'offline' && entry.hidden;
    return {
      id: entry.id,
      icon: meta.icon,
      label: t(meta.label),
      hint: offlineHint ? t('settings.layoutOfflineAuto') : undefined,
      dimmed: entry.hidden,
      trailing: locked ? (
        <span
          title={t('settings.layoutAlwaysVisible')}
          className="w-8 h-8 flex items-center justify-center text-white/20"
        >
          <Lock size={14} />
        </span>
      ) : (
        <RowIconButton
          label={entry.hidden ? t('settings.layoutShow') : t('settings.layoutHide')}
          active={!entry.hidden}
          onClick={() => toggle(entry.id)}
        >
          {entry.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </RowIconButton>
      ),
    };
  });

  return (
    <LayoutList
      items={items}
      onMove={(from, to) => setLayout(scope, moveEntry(layout, from, to))}
    />
  );
}

export function LayoutCard() {
  const { t } = useTranslation();
  const [scope, setScope] = useState<LayoutScope>('sidebar');
  const layout = useLayout(scope);
  const riverHidden = useSettingsStore((s) => s.riverHidden);
  const resetLayout = useSettingsStore((s) => s.resetLayout);
  const pristine =
    isDefaultLayout(layout, LAYOUT_IDS[scope]) && (scope !== 'home' || riverHidden.length === 0);

  return (
    <Card
      title={t('settings.layoutTitle')}
      desc={t('settings.layoutDesc')}
      icon={<LayoutDashboard size={17} />}
      action={
        <button
          type="button"
          disabled={pristine}
          onClick={() => resetLayout(scope)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium text-white/50 bg-white/[0.04] border border-white/[0.06] hover:text-white/85 hover:bg-white/[0.07] transition-all duration-200 cursor-pointer disabled:opacity-0 disabled:pointer-events-none"
        >
          <RotateCcw size={13} />
          {t('settings.layoutReset')}
        </button>
      }
    >
      <div className="space-y-5">
        <Segmented
          value={scope}
          onChange={setScope}
          options={SCOPES.map((s) => ({ id: s.id, label: t(s.labelKey) }))}
        />
        <BlocksEditor key={scope} scope={scope} />
        {scope === 'sidebar' && <PinnedEditor />}
        {scope === 'home' && <RiverSections />}
        <p className="text-[11.5px] leading-snug text-white/30">
          {t(scope === 'sidebar' ? 'settings.layoutSidebarHint' : 'settings.layoutPageHint')}
        </p>
      </div>
    </Card>
  );
}
