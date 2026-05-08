import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { changeAppLanguage } from '../../i18n';
import { art } from '../../lib/formatters';
import {
  Clock,
  Download,
  Globe,
  Home,
  Library,
  ListMusic,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from '../../lib/icons';
import { useAppStatusStore } from '../../stores/app-status';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { Avatar } from '../ui/Avatar';
import { StarBadge, StarCard, StarModal, useStarSubscription } from './StarSubscription';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Turkce' },
] as const;

const navItems = [
  { to: '/home', icon: Home, label: 'nav.home' },
  { to: '/search', icon: Search, label: 'nav.search' },
  { to: '/library', icon: Library, label: 'nav.library' },
  { to: '/offline', icon: Download, label: 'nav.offline' },
];

export const Sidebar = React.memo(() => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const appMode = useAppStatusStore((s) =>
    s.offlineBypass || !s.navigatorOnline || !s.backendReachable ? 'offline' : 'online',
  );
  const { collapsed, pinnedPlaylists, toggleSidebar } = useSettingsStore(
    useShallow((s) => ({
      collapsed: s.sidebarCollapsed,
      pinnedPlaylists: s.pinnedPlaylists,
      toggleSidebar: s.toggleSidebar,
    })),
  );
  const { isPremium, modalOpen, setModalOpen, openModal } = useStarSubscription();

  const toggleLanguage = () => {
    const next = i18n.language === 'ru' ? 'en' : 'ru';
    void changeAppLanguage(next);
  };

  const currentLang = languages.find((l) => l.code === i18n.language) ?? languages[0];

  return (
    <aside
      className="liquid-panel m-2 mr-0 flex h-[calc(100%-16px)] shrink-0 flex-col rounded-[28px] transition-[width] duration-200 ease-[var(--ease-apple)]"
      style={{ width: collapsed ? 56 : 200 }}
    >
      <nav className="flex flex-col gap-1.5 px-2 pt-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? t(item.label) : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl text-[13px] font-medium transition-all duration-200 ease-[var(--ease-apple)] ${
                collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
              } ${
                isActive
                  ? 'liquid-control text-white shadow-[0_12px_28px_rgba(0,0,0,0.20)]'
                  : item.to === '/offline' && appMode !== 'online'
                    ? 'text-white/90 bg-accent/[0.14] ring-1 ring-accent/25'
                    : 'text-white/48 hover:text-white/82 hover:bg-white/[0.075]'
              }`
            }
          >
            <item.icon size={18} strokeWidth={1.8} />
            {!collapsed && t(item.label)}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1.5 px-2 pt-5">
        {!collapsed && (
          <div className="px-3 pb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/20 font-semibold">
            <MapPin size={11} strokeWidth={1.8} />
            {t('sidebar.quickAccess')}
          </div>
        )}

        <NavLink
          to="/library?tab=history"
          title={collapsed ? t('library.history') : undefined}
          className={({ isActive }) =>
            `flex items-center gap-2.5 w-full rounded-2xl text-[12px] font-medium transition-all duration-200 ${
              collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
            } ${
              isActive
                ? 'liquid-control text-white'
                : 'text-white/48 hover:text-white/82 hover:bg-white/[0.075]'
            }`
          }
        >
          <Clock size={16} strokeWidth={1.8} />
          {!collapsed && <span className="truncate">{t('library.history')}</span>}
        </NavLink>

        {pinnedPlaylists.map((playlist) => {
          const artwork = art(playlist.artworkUrl, 'small');

          return (
            <NavLink
              key={playlist.urn}
              to={`/playlist/${encodeURIComponent(playlist.urn)}`}
              title={collapsed ? playlist.title : undefined}
              className={({ isActive }) =>
                `flex items-center gap-2.5 w-full rounded-2xl text-[12px] font-medium transition-all duration-200 ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                } ${
                  isActive
                    ? 'liquid-control text-white'
                    : 'text-white/48 hover:text-white/82 hover:bg-white/[0.075]'
                }`
              }
            >
              {artwork ? (
                <img
                  src={artwork}
                  alt=""
                  className="w-4 h-4 rounded-[4px] object-cover shrink-0 ring-1 ring-white/[0.08]"
                  decoding="async"
                  loading="lazy"
                />
              ) : (
                <ListMusic size={16} strokeWidth={1.8} />
              )}
              {!collapsed && <span className="truncate">{playlist.title}</span>}
            </NavLink>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="px-2 pb-1 flex flex-col gap-0.5">
        <div className="mb-1">
          <StarCard collapsed={collapsed} isPremium={isPremium} onOpenModal={openModal} />
        </div>
        {/* Toggle sidebar */}
        <button
          type="button"
          onClick={toggleSidebar}
          title={collapsed ? t('nav.expand') : undefined}
          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-2xl text-[12px] font-medium text-white/48 hover:text-white/82 hover:bg-white/[0.075] transition-all duration-200 cursor-pointer ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} strokeWidth={1.8} />
          ) : (
            <PanelLeftClose size={16} strokeWidth={1.8} />
          )}
          {!collapsed && <span className="truncate">{t('nav.collapse')}</span>}
        </button>
        <button
          type="button"
          onClick={toggleLanguage}
          title={collapsed ? currentLang.label : undefined}
          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-2xl text-[12px] font-medium text-white/48 hover:text-white/82 hover:bg-white/[0.075] transition-all duration-200 cursor-pointer ${collapsed ? 'justify-center' : ''}`}
        >
          <Globe size={16} strokeWidth={1.8} />
          {!collapsed && <span className="truncate">{currentLang.label}</span>}
        </button>
        <NavLink
          to="/settings"
          title={collapsed ? t('nav.settings') : undefined}
          className={({ isActive }) =>
            `flex items-center gap-2.5 w-full px-3 py-2 rounded-2xl text-[12px] font-medium transition-all duration-200 ${
              collapsed ? 'justify-center' : ''
            } ${
              isActive
                ? 'liquid-control text-white/90'
                : 'text-white/48 hover:text-white/82 hover:bg-white/[0.075]'
            }`
          }
        >
          <Settings size={16} strokeWidth={1.8} />
          {!collapsed && <span className="truncate">{t('nav.settings')}</span>}
        </NavLink>
      </div>

      {user && (
        <div className="px-2 pb-3">
          <NavLink
            to={`/user/${encodeURIComponent(user.urn)}`}
            title={collapsed ? user.username : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2 py-2.5 rounded-2xl transition-all duration-200 cursor-pointer ${
                collapsed ? 'justify-center' : ''
              } ${isActive ? 'liquid-control' : 'hover:bg-white/[0.075]'}`
            }
          >
            <Avatar src={user.avatar_url} alt={user.username} size={26} />
            {!collapsed && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[12px] text-white/40 truncate font-medium">
                  {user.username}
                </span>
                {isPremium && <StarBadge />}
              </div>
            )}
          </NavLink>
        </div>
      )}

      <StarModal open={modalOpen} onOpenChange={setModalOpen} />
    </aside>
  );
});
