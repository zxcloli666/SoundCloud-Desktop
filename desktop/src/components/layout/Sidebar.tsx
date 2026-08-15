import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
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
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { useAppMode } from '../../stores/app-status';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { Avatar } from '../ui/Avatar';

type IconCmp = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

const languages = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Türkçe' },
] as const;

const primaryNav: { to: string; icon: IconCmp; label: string; tab?: string }[] = [
  { to: '/home', icon: Home, label: 'nav.home' },
  { to: '/search', icon: Search, label: 'nav.search' },
  { to: '/library', icon: Library, label: 'nav.library' },
  { to: '/library?tab=likes', icon: Heart, label: 'user.likes', tab: 'likes' },
  { to: '/library?tab=playlists', icon: ListMusic, label: 'user.playlists', tab: 'playlists' },
];

const ROW = 'group relative flex h-11 w-full items-center transition-colors duration-150';

function Label({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  return (
    <span
      className="overflow-hidden whitespace-nowrap text-[12.5px] font-medium"
      style={{
        maxWidth: collapsed ? 0 : 148,
        opacity: collapsed ? 0 : 1,
        transition: 'max-width 260ms var(--ease-apple), opacity 180ms ease',
      }}
    >
      {children}
    </span>
  );
}

function IconBox({ children }: { children: React.ReactNode }) {
  return <span className="flex w-[54px] shrink-0 items-center justify-center">{children}</span>;
}

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
  active,
  alert,
}: {
  to: string;
  icon: IconCmp;
  label: string;
  collapsed: boolean;
  active: boolean;
  alert?: boolean;
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`${ROW} ${active ? 'text-white' : alert ? 'text-accent' : 'text-white/46 hover:bg-white/[0.035] hover:text-white/80'}`}
      style={
        active
          ? {
              background: 'rgba(255,255,255,0.045)',
              boxShadow: 'inset 3px 0 0 var(--color-accent)',
            }
          : undefined
      }
    >
      <IconBox>
        <Icon size={17} strokeWidth={1.75} />
      </IconBox>
      <Label collapsed={collapsed}>{label}</Label>
    </NavLink>
  );
}

export const Sidebar = React.memo(() => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const appMode = useAppMode();
  const { collapsed, pinnedPlaylists, toggleSidebar } = useSettingsStore(
    useShallow((state) => ({
      collapsed: state.sidebarCollapsed,
      pinnedPlaylists: state.pinnedPlaylists,
      toggleSidebar: state.toggleSidebar,
    })),
  );
  const perf = usePerfMode();
  const params = new URLSearchParams(location.search);
  const activeTab = params.get('tab');
  const currentLang = languages.find((language) => language.code === i18n.language) ?? languages[0];
  const toggleLanguage = () => void changeAppLanguage(i18n.language === 'ru' ? 'en' : 'ru');
  const isPrimaryActive = (to: string, tab?: string) => {
    const path = to.split('?')[0];
    if (location.pathname !== path) return false;
    if (path !== '/library') return true;
    return tab ? activeTab === tab : !activeTab;
  };

  return (
    <aside
      className="sonveil-sidebar relative z-20 flex h-full shrink-0 flex-col overflow-hidden border-r border-white/[0.09] bg-[#0b0b0d]"
      style={{
        width: collapsed ? 62 : 208,
        transition: `width ${perf.mode === 'light' ? '0ms' : '280ms'} var(--ease-apple)`,
      }}
    >
      <div className="flex h-[68px] shrink-0 items-center border-b border-white/[0.08]">
        <span
          className="flex h-full shrink-0 items-center overflow-hidden whitespace-nowrap font-serif text-[14px] tracking-[0.36em] text-[#f0ede6]"
          style={{
            width: collapsed ? 62 : 208,
            justifyContent: collapsed ? 'center' : 'flex-start',
            paddingLeft: collapsed ? 0 : 22,
            transition: 'width 260ms var(--ease-apple), padding 260ms var(--ease-apple)',
          }}
        >
          {collapsed ? 'S' : 'SONVEIL'}
        </span>
      </div>

      <nav className="flex flex-col py-3">
        {primaryNav.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={t(item.label)}
            collapsed={collapsed}
            active={isPrimaryActive(item.to, item.tab)}
          />
        ))}
      </nav>

      <div className="mx-4 border-t border-white/[0.075]" />
      <div className="flex flex-col py-3">
        {!collapsed && (
          <p className="mb-1 px-[18px] text-[9px] font-semibold uppercase tracking-[0.16em] text-white/24">
            {t('sidebar.quickAccess')}
          </p>
        )}
        <NavItem
          to="/discover"
          icon={Compass}
          label={t('nav.discover')}
          collapsed={collapsed}
          active={location.pathname === '/discover'}
        />
        <NavItem
          to="/library?tab=history"
          icon={Clock}
          label={t('library.history')}
          collapsed={collapsed}
          active={location.pathname === '/library' && activeTab === 'history'}
        />
        <NavItem
          to="/offline"
          icon={Download}
          label={t('nav.offline')}
          collapsed={collapsed}
          active={location.pathname === '/offline'}
          alert={appMode !== 'online'}
        />

        {pinnedPlaylists.map((playlist) => {
          const artwork = art(playlist.artworkUrl, 'small');
          const active = location.pathname === `/playlist/${encodeURIComponent(playlist.urn)}`;
          return (
            <NavLink
              key={playlist.urn}
              to={`/playlist/${encodeURIComponent(playlist.urn)}`}
              title={collapsed ? playlist.title : undefined}
              className={`${ROW} ${active ? 'text-white' : 'text-white/46 hover:bg-white/[0.035] hover:text-white/80'}`}
              style={
                active
                  ? {
                      background: 'rgba(255,255,255,0.045)',
                      boxShadow: 'inset 3px 0 0 var(--color-accent)',
                    }
                  : undefined
              }
            >
              <IconBox>
                {artwork ? (
                  <img src={artwork} alt="" className="size-[18px] rounded-[2px] object-cover" />
                ) : (
                  <ListMusic size={16} strokeWidth={1.75} />
                )}
              </IconBox>
              <Label collapsed={collapsed}>{playlist.title}</Label>
            </NavLink>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="border-t border-white/[0.075] py-2">
        <button
          type="button"
          onClick={toggleSidebar}
          className={`${ROW} text-white/42 hover:bg-white/[0.035] hover:text-white/78`}
        >
          <IconBox>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </IconBox>
          <Label collapsed={collapsed}>{t('nav.collapse')}</Label>
        </button>
        <button
          type="button"
          onClick={toggleLanguage}
          className={`${ROW} text-white/42 hover:bg-white/[0.035] hover:text-white/78`}
        >
          <IconBox>
            <Globe size={17} />
          </IconBox>
          <Label collapsed={collapsed}>{currentLang.label}</Label>
        </button>
        <NavItem
          to="/settings"
          icon={Settings}
          label={t('nav.settings')}
          collapsed={collapsed}
          active={location.pathname === '/settings'}
        />
      </div>

      {user && (
        <NavLink
          to={`/user/${encodeURIComponent(user.urn)}`}
          className={`${ROW} h-[58px] border-t border-white/[0.075] text-white/56 hover:bg-white/[0.035] hover:text-white/84`}
        >
          <IconBox>
            <Avatar src={user.avatar_url} alt={user.username} size={28} />
          </IconBox>
          <Label collapsed={collapsed}>{user.username}</Label>
        </NavLink>
      )}
    </aside>
  );
});
