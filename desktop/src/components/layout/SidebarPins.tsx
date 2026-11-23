import { arrayMove } from '@dnd-kit/sortable';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { art } from '../../lib/formatters';
import { ListMusic, X } from '../../lib/icons';
import { moveEntry } from '../../lib/layout';
import { useSuperlikeCount } from '../../lib/superlikes';
import { useLayout, useToggleLayoutEntry } from '../../lib/use-layout';
import { useSettingsStore } from '../../stores/settings';
import { itemMeta } from '../settings/cards/layout-items';
import { Avatar } from '../ui/Avatar';
import { IconBox, Label, ROW } from './SidebarChrome';
import { SortableSlot, SortableStack } from './SortableStack';

function PinnedRow({
  to,
  title,
  icon,
  collapsed,
  unpinLabel,
  onUnpin,
}: {
  to: string;
  title: string;
  icon: React.ReactNode;
  collapsed: boolean;
  unpinLabel: string;
  onUnpin: () => void;
}) {
  return (
    <div className="group/pin relative">
      <NavLink
        to={to}
        title={collapsed ? title : undefined}
        className={({ isActive }) =>
          `${ROW} ${isActive ? '' : 'text-ink-50 hover:text-ink hover:bg-ink/[0.05]'}`
        }
      >
        <IconBox>{icon}</IconBox>
        <Label
          collapsed={collapsed}
          className="text-[12.5px] font-medium pr-3 transition-[padding] group-hover/pin:pr-8"
        >
          {title}
        </Label>
      </NavLink>
      {!collapsed && (
        <button
          type="button"
          onClick={onUnpin}
          title={unpinLabel}
          aria-label={unpinLabel}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-ink-40 hover:text-ink hover:bg-ink/[0.1] opacity-0 group-hover/pin:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 cursor-pointer"
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

function QuickRows({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const layout = useLayout('quick');
  const setLayout = useSettingsStore((s) => s.setLayout);
  const toggle = useToggleLayoutEntry('quick');
  const hasSuperlikes = useSuperlikeCount() > 0;
  const ids = layout
    .filter((entry) => !entry.hidden && (entry.id !== 'superlikes' || hasSuperlikes))
    .map((entry) => entry.id);

  return (
    <SortableStack ids={ids} onMove={(from, to) => setLayout('quick', moveEntry(layout, from, to))}>
      {ids.map((id) => {
        const meta = itemMeta('quick', id);
        return (
          <SortableSlot key={id} id={id}>
            <PinnedRow
              to={`/library/${id}`}
              title={t(meta.label)}
              collapsed={collapsed}
              unpinLabel={t('sidebar.unpin')}
              onUnpin={() => toggle(id)}
              icon={meta.icon}
            />
          </SortableSlot>
        );
      })}
    </SortableStack>
  );
}

export function SidebarPins({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const { pinnedPlaylists, pinnedArtists, unpinPlaylist, unpinArtist, reorderPinned } =
    useSettingsStore(
      useShallow((s) => ({
        pinnedPlaylists: s.pinnedPlaylists,
        pinnedArtists: s.pinnedArtists,
        unpinPlaylist: s.unpinPlaylist,
        unpinArtist: s.unpinArtist,
        reorderPinned: s.reorderPinnedPlaylists,
      })),
    );
  const pinnedUrns = pinnedPlaylists.map((p) => p.urn);
  const movePinned = (from: string, to: string) =>
    reorderPinned(arrayMove(pinnedUrns, pinnedUrns.indexOf(from), pinnedUrns.indexOf(to)));

  return (
    <div data-ui="sidebar-pins" className="contents">
      <QuickRows collapsed={collapsed} />

      <SortableStack ids={pinnedUrns} onMove={movePinned}>
        {pinnedPlaylists.map((playlist) => {
          const artwork = art(playlist.artworkUrl, 'small');
          return (
            <SortableSlot key={playlist.urn} id={playlist.urn}>
              <PinnedRow
                to={`/playlist/${encodeURIComponent(playlist.urn)}`}
                title={playlist.title}
                collapsed={collapsed}
                unpinLabel={t('sidebar.unpinPlaylist')}
                onUnpin={() => unpinPlaylist(playlist.urn)}
                icon={
                  artwork ? (
                    <img
                      src={artwork}
                      alt=""
                      className="w-[18px] h-[18px] rounded-[5px] object-cover ring-1 ring-ink/[0.1]"
                      decoding="async"
                      loading="lazy"
                    />
                  ) : (
                    <ListMusic size={17} strokeWidth={1.9} />
                  )
                }
              />
            </SortableSlot>
          );
        })}
      </SortableStack>

      {pinnedPlaylists.length > 0 && pinnedArtists.length > 0 && (
        <div className="mx-3 my-1.5 h-px bg-ink/[0.06]" />
      )}

      {pinnedArtists.map((artist) => (
        <PinnedRow
          key={artist.id}
          to={artist.path}
          title={artist.name}
          collapsed={collapsed}
          unpinLabel={t('sidebar.unpinArtist')}
          onUnpin={() => unpinArtist(artist.id)}
          icon={
            <Avatar src={artist.avatarUrl} alt="" size={20} className="ring-1 ring-ink/[0.12]" />
          }
        />
      ))}
    </div>
  );
}
