import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import sonveilMark from '../../assets/sonveil-mark.svg';
import { Home, Library, Search, Settings } from '../../lib/icons';
import { useAuthStore } from '../../stores/auth';
import { Avatar } from '../ui/Avatar';

type IconCmp = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
  fill?: string;
  fillOpacity?: number;
}>;

const primaryNav: { to: string; icon: IconCmp; label: string; solid?: boolean }[] = [
  { to: '/home', icon: Home, label: 'nav.home', solid: true },
  { to: '/search', icon: Search, label: 'nav.search' },
  { to: '/library/likes', icon: Library, label: 'nav.library' },
  { to: '/settings', icon: Settings, label: 'nav.settings' },
];

function RailLink({
  to,
  icon: Icon,
  label,
  active,
  solid,
}: {
  to: string;
  icon: IconCmp;
  label: string;
  active: boolean;
  solid?: boolean;
}) {
  return (
    <NavLink
      to={to}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`sonveil-rail-button${active ? ' is-active' : ''}`}
    >
      <Icon
        size={22}
        strokeWidth={active ? 2.15 : 1.75}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? (solid ? 1 : 0.16) : undefined}
      />
    </NavLink>
  );
}

export const Sidebar = React.memo(() => {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const libraryActive =
    location.pathname === '/library' || location.pathname.startsWith('/library/');
  const isPrimaryActive = (to: string) =>
    to === '/library/likes' ? libraryActive : location.pathname === to;

  return (
    <aside className="sonveil-sidebar" aria-label={t('nav.library')}>
      <NavLink to="/home" className="sonveil-mark" aria-label="Sonveil">
        <img src={sonveilMark} alt="" draggable={false} />
      </NavLink>

      <nav className="sonveil-rail-nav" aria-label={t('nav.home')}>
        {primaryNav.map((item) => (
          <RailLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={t(item.label)}
            active={isPrimaryActive(item.to)}
            solid={item.solid}
          />
        ))}
      </nav>

      <div className="sonveil-rail-spacer" />

      {user && (
        <NavLink
          to={`/user/${encodeURIComponent(user.urn)}`}
          className="sonveil-rail-profile"
          title={user.username}
          aria-label={user.username}
        >
          <Avatar src={user.avatar_url} alt={user.username} size={36} />
        </NavLink>
      )}
    </aside>
  );
});
