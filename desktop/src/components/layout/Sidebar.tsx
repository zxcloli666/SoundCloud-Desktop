import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { changeAppLanguage } from '../../i18n';
import { art } from '../../lib/formatters';
import {
  Clock,
  Compass,
  Download,
  Globe,
  Heart,
  Home,
  Library,
  ListMusic,
  Search,
  Settings,
} from '../../lib/icons';
import { useAppMode } from '../../stores/app-status';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { Avatar } from '../ui/Avatar';

type IconCmp = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

const primaryNav: { to: string; icon: IconCmp; label: string; tab?: string }[] = [
  { to: '/home', icon: Home, label: 'nav.home' },
  { to: '/search', icon: Search, label: 'nav.search' },
  { to: '/library', icon: Library, label: 'nav.library' },
  { to: '/library?tab=likes', icon: Heart, label: 'user.likes', tab: 'likes' },
];

function RailLink({
  to,
  icon: Icon,
  label,
  active,
  alert,
}: {
  to: string;
  icon: IconCmp;
  label: string;
  active: boolean;
  alert?: boolean;
}) {
  return (
    <NavLink
      to={to}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`sonveil-rail-button${active ? ' is-active' : ''}${alert ? ' is-alert' : ''}`}
    >
      <Icon size={19} strokeWidth={1.75} />
    </NavLink>
  );
}

export const Sidebar = React.memo(() => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const pinnedPlaylists = useSettingsStore((state) => state.pinnedPlaylists);
  const appMode = useAppMode();
  const params = new URLSearchParams(location.search);
  const activeTab = params.get('tab');
  const isPrimaryActive = (to: string, tab?: string) => {
    const path = to.split('?')[0];
    if (location.pathname !== path) return false;
    if (path !== '/library') return true;
    return tab ? activeTab === tab : !activeTab;
  };

  return (
    <aside className="sonveil-sidebar" aria-label={t('nav.library')}>
      <NavLink to="/home" className="sonveil-mark" aria-label="Sonveil">
        <span>S</span>
      </NavLink>

      <nav className="sonveil-rail-nav" aria-label={t('nav.home')}>
        {primaryNav.map((item) => (
          <RailLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={t(item.label)}
            active={isPrimaryActive(item.to, item.tab)}
          />
        ))}
        <RailLink
          to="/discover"
          icon={Compass}
          label={t('nav.discover')}
          active={location.pathname === '/discover'}
        />
      </nav>

      <div className="sonveil-rail-divider" />

      <div className="sonveil-rail-covers" aria-label={t('sidebar.quickAccess')}>
        {pinnedPlaylists.slice(0, 5).map((playlist) => {
          const artwork = art(playlist.artworkUrl, 'small');
          return (
            <NavLink
              key={playlist.urn}
              to={`/playlist/${encodeURIComponent(playlist.urn)}`}
              className="sonveil-rail-cover"
              title={playlist.title}
            >
              {artwork ? (
                <img src={artwork} alt="" loading="lazy" decoding="async" />
              ) : (
                <ListMusic size={17} />
              )}
            </NavLink>
          );
        })}
      </div>

      <div className="sonveil-rail-spacer" />

      <div className="sonveil-rail-footer">
        <RailLink
          to="/library?tab=history"
          icon={Clock}
          label={t('library.history')}
          active={location.pathname === '/library' && activeTab === 'history'}
        />
        <RailLink
          to="/offline"
          icon={Download}
          label={t('nav.offline')}
          active={location.pathname === '/offline'}
          alert={appMode !== 'online'}
        />
        <button
          type="button"
          className="sonveil-rail-button"
          title={i18n.language === 'ru' ? 'English' : 'Русский'}
          aria-label={i18n.language === 'ru' ? 'English' : 'Русский'}
          onClick={() => void changeAppLanguage(i18n.language === 'ru' ? 'en' : 'ru')}
        >
          <Globe size={18} strokeWidth={1.75} />
        </button>
        <RailLink
          to="/settings"
          icon={Settings}
          label={t('nav.settings')}
          active={location.pathname === '/settings'}
        />
      </div>

      {user && (
        <NavLink
          to={`/user/${encodeURIComponent(user.urn)}`}
          className="sonveil-rail-profile"
          title={user.username}
          aria-label={user.username}
        >
          <Avatar src={user.avatar_url} alt={user.username} size={30} />
        </NavLink>
      )}
    </aside>
  );
});
