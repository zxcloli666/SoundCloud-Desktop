import React, { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { changeAppLanguage } from '../../i18n';
import { Clock, Globe, PanelLeftClose, PanelLeftOpen, Settings } from '../../lib/icons';
import { moveEntry } from '../../lib/layout';
import { useReleaseFeed } from '../../lib/new-releases-api';
import { usePerfMode } from '../../lib/perf';
import { useOwnTenure } from '../../lib/star-tenure';
import { useSuperlikeCount } from '../../lib/superlikes';
import { useLayout } from '../../lib/use-layout';
import { useAppMode } from '../../stores/app-status';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { ChatNavBadge } from '../chat/shell/ChatNavBadge';
import { SuperHeart } from '../music/superlike/SuperHeart';
import { Avatar } from '../ui/Avatar';
import { useLayoutMenu } from './LayoutMenu';
import { type IconCmp, NAV_ITEMS } from './nav-items';
import {
  IconBox,
  Label,
  ROW,
  sidebarWidth,
  useNarrowWindow,
  useSidebarCollapsed,
} from './SidebarChrome';
import { SidebarPins } from './SidebarPins';
import { SortableSlot, SortableStack } from './SortableStack';
import { StarCard } from './StarCard';
import { StarBadge, useStarSubscription } from './StarSubscription';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ko', label: '한국어' },
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
] as const;

function CountBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  if (count <= 0) return null;
  if (collapsed) {
    return <span className="absolute right-2 top-1.5 size-2 rounded-full bg-accent" />;
  }
  return (
    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-accent px-1.5 text-[10.5px] font-black leading-[16px] tabular-nums text-accent-contrast">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
  title,
  alert,
  badge,
}: {
  to: string;
  icon: IconCmp;
  label: string;
  collapsed: boolean;
  title?: string;
  alert?: boolean;
  badge?: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      title={title}
      data-ui="nav-item"
      className={({ isActive }) =>
        `${ROW} ${
          isActive
            ? ''
            : alert
              ? 'text-ink bg-accent/[0.1] hover:bg-accent/[0.16]'
              : 'text-ink-50 hover:text-ink hover:bg-ink/[0.05]'
        }`
      }
    >
      <IconBox>
        <Icon size={18} strokeWidth={1.8} />
      </IconBox>
      <Label collapsed={collapsed} className="text-[13px] font-medium pr-3">
        {label}
      </Label>
      {badge}
    </NavLink>
  );
}

export const Sidebar = React.memo(() => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const appMode = useAppMode();
  const collapsed = useSidebarCollapsed();
  const narrow = useNarrowWindow();
  const { toggleSidebar, setLayout } = useSettingsStore(
    useShallow((s) => ({
      toggleSidebar: s.toggleSidebar,
      setLayout: s.setLayout,
    })),
  );
  const layout = useLayout('sidebar');
  const layoutMenu = useLayoutMenu('sidebar');
  const navIds = layout
    .filter((e) => !e.hidden || (e.id === 'offline' && appMode !== 'online'))
    .map((e) => e.id);
  const moveNav = (from: string, to: string) => setLayout('sidebar', moveEntry(layout, from, to));
  const { isPremium } = useStarSubscription();
  const ownTenure = useOwnTenure();
  const perf = usePerfMode();
  const superlikeCount = useSuperlikeCount();
  const { unheard } = useReleaseFeed();

  const toggleLanguage = () => {
    void changeAppLanguage(i18n.language === 'ru' ? 'en' : 'ru');
  };
  const currentLang = languages.find((l) => l.code === i18n.language) ?? languages[0];

  const btnCls = `${ROW} text-ink-50 hover:text-ink hover:bg-ink/[0.05] cursor-pointer`;

  return (
    <aside
      data-ui="sidebar"
      onContextMenu={(e) => {
        if (!e.defaultPrevented) layoutMenu.onContextMenu(e);
      }}
      className="shrink-0 flex flex-col h-full overflow-hidden [@media(max-height:560px)]:overflow-y-auto scrollbar-hide border-r border-[color:var(--shell-line)] bg-[var(--shell-side)] pb-3 transition-[width] duration-300 ease-[var(--ease-apple)]"
      style={{
        width: sidebarWidth(collapsed),
        transitionDuration: perf.mode === 'light' ? '0ms' : undefined,
      }}
    >
      <nav className="flex flex-col gap-2 px-2 pt-3">
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
                  badge={
                    id === 'chats' ? (
                      <ChatNavBadge collapsed={collapsed} />
                    ) : id === 'library' ? (
                      <CountBadge count={unheard} collapsed={collapsed} />
                    ) : undefined
                  }
                />
              </SortableSlot>
            );
          })}
        </SortableStack>
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide [@media(max-height:560px)]:flex-none [@media(max-height:560px)]:overflow-visible px-2 pt-4 pb-2 space-y-0.5">
        <div className="relative h-5 mx-1 mb-0.5">
          <span
            className="absolute inset-x-0 top-1/2 h-px"
            style={{
              background: 'var(--shell-line)',
              opacity: collapsed ? 1 : 0,
              transition: 'opacity 240ms ease',
            }}
          />
          <span
            className="absolute inset-0 flex items-center gap-2 px-2 text-[10px] uppercase tracking-[0.18em] text-ink-25 font-semibold whitespace-nowrap"
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

        {superlikeCount > 0 && (
          <NavItem
            to="/library/superlikes"
            icon={SuperHeart}
            label={t('superlikes.title')}
            collapsed={collapsed}
            title={collapsed ? t('superlikes.title') : undefined}
          />
        )}

        <SidebarPins collapsed={collapsed} />
      </div>

      <div className="px-2 pb-1 flex flex-col gap-0.5">
        <div className="mb-1">
          <StarCard collapsed={collapsed} />
        </div>

        {!narrow && (
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
        )}

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
            data-ui="profile"
            className={({ isActive }) => `${ROW} ${isActive ? '' : 'hover:bg-ink/[0.05]'}`}
          >
            <span className="w-10 shrink-0 flex items-center justify-center">
              <Avatar src={user.avatar_url} alt={user.username} size={26} />
            </span>
            <Label collapsed={collapsed} className="flex items-center gap-1.5 pr-3">
              <span className="text-[12.5px] text-ink-70 truncate font-medium">
                {user.username}
              </span>
              {isPremium && <StarBadge tier={ownTenure?.tier ?? 0} />}
            </Label>
          </NavLink>
        </div>
      )}
      {layoutMenu.menu}
    </aside>
  );
});
