import type React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { art } from '../../lib/formatters';
import { ListMusic, X } from '../../lib/icons';
import { useSettingsStore } from '../../stores/settings';
import { Avatar } from '../ui/Avatar';
import { ACTIVE, IconBox, Label, ROW } from './SidebarChrome';

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
          `${ROW} ${isActive ? '' : 'text-white/45 hover:text-white/80 hover:bg-white/[0.05]'}`
        }
        style={({ isActive }) => (isActive ? ACTIVE : undefined)}
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
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.1] opacity-0 group-hover/pin:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 cursor-pointer"
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

export function SidebarPins({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const { pinnedPlaylists, pinnedArtists, unpinPlaylist, unpinArtist } = useSettingsStore(
    useShallow((s) => ({
      pinnedPlaylists: s.pinnedPlaylists,
      pinnedArtists: s.pinnedArtists,
      unpinPlaylist: s.unpinPlaylist,
      unpinArtist: s.unpinArtist,
    })),
  );

  return (
    <>
      {pinnedPlaylists.map((playlist) => {
        const artwork = art(playlist.artworkUrl, 'small');
        return (
          <PinnedRow
            key={playlist.urn}
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
                  className="w-[18px] h-[18px] rounded-[5px] object-cover ring-1 ring-white/[0.1]"
                  decoding="async"
                  loading="lazy"
                />
              ) : (
                <ListMusic size={17} strokeWidth={1.9} />
              )
            }
          />
        );
      })}

      {pinnedPlaylists.length > 0 && pinnedArtists.length > 0 && (
        <div className="mx-3 my-1.5 h-px bg-white/[0.06]" />
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
            <Avatar src={artist.avatarUrl} alt="" size={20} className="ring-1 ring-white/[0.12]" />
          }
        />
      ))}
    </>
  );
}
