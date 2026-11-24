import { arrayMove } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { art } from '../../lib/formatters';
import { ListMusic } from '../../lib/icons';
import { moveEntry } from '../../lib/layout';
import { staysLast } from '../../lib/layout-rest';
import { useSuperlikeCount } from '../../lib/superlikes';
import { useLayout, useToggleLayoutEntry } from '../../lib/use-layout';
import { useSettingsStore } from '../../stores/settings';
import { itemMeta } from '../settings/cards/layout-items';
import { Avatar } from '../ui/Avatar';
import { SidebarRow } from './SidebarRow';
import { SortableSlot, SortableStack } from './SortableStack';

function QuickRows({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const layout = useLayout('quick');
  const setLayout = useSettingsStore((s) => s.setLayout);
  const toggle = useToggleLayoutEntry('quick');
  const hasSuperlikes = useSuperlikeCount() > 0;
  const ids = layout
    .filter((entry) => !entry.hidden && !staysLast(entry.id))
    .filter((entry) => entry.id !== 'superlikes' || hasSuperlikes)
    .map((entry) => entry.id);

  return (
    <SortableStack ids={ids} onMove={(from, to) => setLayout('quick', moveEntry(layout, from, to))}>
      {ids.map((id) => {
        const meta = itemMeta('quick', id);
        return (
          <SortableSlot key={id} id={id}>
            <SidebarRow
              to={`/library/${id}`}
              title={t(meta.label)}
              collapsed={collapsed}
              actionLabel={t('sidebar.unpin')}
              onAction={() => toggle(id)}
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
              <SidebarRow
                to={`/playlist/${encodeURIComponent(playlist.urn)}`}
                title={playlist.title}
                collapsed={collapsed}
                actionLabel={t('sidebar.unpinPlaylist')}
                onAction={() => unpinPlaylist(playlist.urn)}
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
        <SidebarRow
          key={artist.id}
          to={artist.path}
          title={artist.name}
          collapsed={collapsed}
          actionLabel={t('sidebar.unpinArtist')}
          onAction={() => unpinArtist(artist.id)}
          icon={
            <Avatar src={artist.avatarUrl} alt="" size={20} className="ring-1 ring-ink/[0.12]" />
          }
        />
      ))}
    </div>
  );
}
