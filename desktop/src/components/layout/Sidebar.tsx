import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { changeAppLanguage } from '../../i18n';
import { Clock, Globe, PanelLeftClose, PanelLeftOpen, Settings } from '../../lib/icons';
import { moveEntry } from '../../lib/layout';
import { usePerfMode } from '../../lib/perf';
import { useLayout } from '../../lib/use-layout';
import { useAppMode } from '../../stores/app-status';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { Avatar } from '../ui/Avatar';
import { type IconCmp, NAV_ITEMS } from './nav-items';
import { ACTIVE, IconBox, Label, ROW, sidebarWidth } from './SidebarChrome';
import { SidebarPins } from './SidebarPins';
import { SortableSlot, SortableStack } from './SortableStack';
import { StarBadge, StarCard, useStarSubscription } from './StarSubscription';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Turkce' },
  { code: 'ko', label: '한국어' },
] as const;

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
  title,
  alert,
}: {
  to: string;
  icon: IconCmp;
  label: string;
  collapsed: boolean;
  title?: string;
  alert?: boolean;
}) {
  return (
    <NavLink
      to={to}
      title={title}
      className={({ isActive }) =>
        `${ROW} ${
          isActive
            ? ''
            : alert
              ? 'text-white/85 bg-accent/[0.08] ring-1 ring-accent/20 hover:text-white'
              : 'text-white/45 hover:text-white/80 hover:bg-white/[0.05]'
        }`
      }
      style={({ isActive }) => (isActive ? ACTIVE : undefined)}
    >
      <IconBox>
        <Icon size={18} strokeWidth={1.9} />
      </IconBox>
      <Label collapsed={collapsed} className="text-[13px] font-medium pr-3">
        {label}
      </Label>
    </NavLink>
  );
}

export const Sidebar = React.memo(() => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const appMode = useAppMode();
  const { collapsed, toggleSidebar, setLayout } = useSettingsStore(
    useShallow((s) => ({
      collapsed: s.sidebarCollapsed,
      toggleSidebar: s.toggleSidebar,
      setLayout: s.setLayout,
    })),
  );
  const layout = useLayout('sidebar');
  const navIds = layout
    .filter((e) => !e.hidden || (e.id === 'offline' && appMode !== 'online'))
    .map((e) => e.id);
  const moveNav = (from: string, to: string) => setLayout('sidebar', moveEntry(layout, from, to));
  const { isPremium } = useStarSubscription();
  const navigate = useNavigate();
  const openStar = useCallback(() => navigate('/star'), [navigate]);
  const perf = usePerfMode();

  const toggleLanguage = () => {
    void changeAppLanguage(i18n.language === 'ru' ? 'en' : 'ru');
  };
  const currentLang = languages.find((l) => l.code === i18n.language) ?? languages[0];

  const btnCls = `${ROW} text-white/45 hover:text-white/80 hover:bg-white/[0.05] cursor-pointer`;

  return (
    <aside
      data-ui="sidebar"
      className="shrink-0 flex flex-col h-full overflow-hidden border-r border-white/[0.05] pb-3 transition-[width] duration-300 ease-[var(--ease-apple)]"
      style={{
        width: sidebarWidth(collapsed),
        transitionDuration: perf.mode === 'light' ? '0ms' : undefined,
      }}
    >
      <nav className="flex flex-col gap-0.5 px-2 pt-3">
        <SortableStack ids={navIds} onMove={moveNav}>
          {navIds.map((id) => {
            const item = NAV_ITEMS[id];
            return (
              <SortableSlot key={id} id={id}>
                <NavItem
                  to={item.to}
                  icon={item.icon}
                  label={t(item.label)}
                  collapsed={collapsed}
                  title={collapsed ? t(item.label) : undefined}
                  alert={id === 'offline' && appMode !== 'online'}
                />
              </SortableSlot>
            );
          })}
        </SortableStack>
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-2 pt-4 pb-2 space-y-0.5">
        <div className="relative h-5 mx-1 mb-0.5">
          <span
            className="absolute inset-x-0 top-1/2 h-px"
            style={{
              background: 'rgba(255,255,255,0.07)',
              opacity: collapsed ? 1 : 0,
              transition: 'opacity 240ms ease',
            }}
          />
          <span
            className="absolute inset-0 flex items-center gap-2 px-2 text-[10px] uppercase tracking-[0.18em] text-white/25 font-semibold whitespace-nowrap"
            style={{ opacity: collapsed ? 0 : 1, transition: 'opacity 240ms ease' }}
          >
            {t('sidebar.quickAccess')}
          </span>
        </div>

        <NavItem
          to="/library/history"
          icon={Clock}
          label={t('library.history')}
          collapsed={collapsed}
          title={collapsed ? t('library.history') : undefined}
        />

        <SidebarPins collapsed={collapsed} />
      </div>

      <div className="px-2 pb-1 flex flex-col gap-0.5">
        <div className="mb-1">
          <StarCard collapsed={collapsed} isPremium={isPremium} onOpen={openStar} />
        </div>

        <button
          type="button"
          onClick={toggleSidebar}
          title={collapsed ? t('nav.expand') : undefined}
          className={btnCls}
        >
          <IconBox>
            {collapsed ? (
              <PanelLeftOpen size={17} strokeWidth={1.9} />
            ) : (
              <PanelLeftClose size={17} strokeWidth={1.9} />
            )}
          </IconBox>
          <Label collapsed={collapsed} className="text-[12.5px] font-medium pr-3">
            {t('nav.collapse')}
          </Label>
        </button>

        <button
          type="button"
          onClick={toggleLanguage}
          title={collapsed ? currentLang.label : undefined}
          className={btnCls}
        >
          <IconBox>
            <Globe size={17} strokeWidth={1.9} />
          </IconBox>
          <Label collapsed={collapsed} className="text-[12.5px] font-medium pr-3">
            {currentLang.label}
          </Label>
        </button>

        <NavItem
          to="/settings"
          icon={Settings}
          label={t('nav.settings')}
          collapsed={collapsed}
          title={collapsed ? t('nav.settings') : undefined}
        />
      </div>

      {user && (
        <div className="px-2 pb-3">
          <NavLink
            to={`/user/${encodeURIComponent(user.urn)}`}
            title={collapsed ? user.username : undefined}
            className={({ isActive }) => `${ROW} ${isActive ? '' : 'hover:bg-white/[0.05]'}`}
            style={({ isActive }) => (isActive ? ACTIVE : undefined)}
          >
            <span className="w-10 shrink-0 flex items-center justify-center">
              <Avatar src={user.avatar_url} alt={user.username} size={26} />
            </span>
            <Label collapsed={collapsed} className="flex items-center gap-1.5 pr-3">
              <span className="text-[12.5px] text-white/55 truncate font-medium">
                {user.username}
              </span>
              {isPremium && <StarBadge />}
            </Label>
          </NavLink>
        </div>
      )}
    </aside>
  );
});
