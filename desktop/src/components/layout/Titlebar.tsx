import { getCurrentWindow } from '@tauri-apps/api/window';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import appIcon from '../../assets/app-icon.png';
import {
  ChevronLeft,
  ChevronRight,
  Fullscreen,
  Home,
  Minus,
  Moon,
  RefreshCw,
  Square,
  Sun,
  X,
} from '../../lib/icons';
import { reloadApp } from '../../lib/reload';
import { useScheme } from '../../lib/scheme';
import { toggleWindowFullscreen } from '../../lib/window';
import { useSettingsStore } from '../../stores/settings';
import { GlobalSearch } from './GlobalSearch';
import { useSidebarCollapsed } from './SidebarChrome';

const NavButtons = React.memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.key !== 'default';
  const onHome = location.pathname === '/home';

  return (
    <div data-ui="titlebar-navigation" className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={!canGoBack}
        onClick={() => navigate(-1)}
        className="shell-btn"
        aria-label="Back"
      >
        <ChevronLeft size={17} strokeWidth={2.2} />
      </button>
      <button type="button" onClick={() => navigate(1)} className="shell-btn" aria-label="Forward">
        <ChevronRight size={17} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        onClick={() => navigate('/home')}
        aria-label="Home"
        aria-current={onHome ? 'page' : undefined}
        className="shell-btn"
      >
        <Home size={16} strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={() => void reloadApp()}
        className="shell-btn"
        aria-label={t('nav.reload')}
        title={t('nav.reload')}
      >
        <RefreshCw size={15} strokeWidth={2} />
      </button>
    </div>
  );
});

const SchemeToggle = React.memo(() => {
  const { t } = useTranslation();
  const scheme = useScheme();
  const setScheme = useSettingsStore((s) => s.setScheme);
  const label = t(scheme === 'dark' ? 'nav.lightMode' : 'nav.darkMode');
  return (
    <button
      type="button"
      data-ui="scheme-toggle"
      className="shell-btn"
      aria-label={label}
      title={label}
      onClick={() => setScheme(scheme === 'dark' ? 'white' : 'dark')}
    >
      {scheme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
    </button>
  );
});

const WinButton = ({
  onClick,
  danger,
  label,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  label: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`w-10 h-9 rounded-lg flex items-center justify-center text-ink-40 transition-colors duration-150 cursor-pointer ${
      danger ? 'hover:text-white hover:bg-red-500/80' : 'hover:text-ink hover:bg-ink/[0.07]'
    }`}
  >
    {children}
  </button>
);

export const WindowControls = React.memo(() => {
  const { t } = useTranslation();
  const win = getCurrentWindow();
  return (
    <div data-ui="window-controls" className="flex items-center gap-0.5 shrink-0">
      <WinButton onClick={() => void toggleWindowFullscreen()} label={t('kb.fullscreen')}>
        <Fullscreen size={13} />
      </WinButton>
      <WinButton onClick={() => win.minimize()} label="Minimize">
        <Minus size={15} />
      </WinButton>
      <WinButton onClick={() => win.toggleMaximize()} label="Maximize">
        <Square size={12} />
      </WinButton>
      <WinButton onClick={() => win.close()} danger label="Close">
        <X size={15} />
      </WinButton>
    </div>
  );
});

export const Titlebar = React.memo(() => {
  const collapsed = useSidebarCollapsed();

  return (
    <div
      data-ui="titlebar"
      className="relative z-50 h-14 flex items-center gap-3 px-3 select-none shrink-0 border-b border-[color:var(--shell-line)] bg-[var(--shell-top)]"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-3 shrink-0" data-tauri-drag-region>
        <div className="flex items-center" data-tauri-drag-region>
          <img
            src={appIcon}
            alt="SoundCloud"
            draggable={false}
            data-tauri-drag-region
            data-ui="brand"
            className="w-8 h-8 rounded-[10px] shrink-0"
          />
          <span
            data-tauri-drag-region
            className="overflow-hidden whitespace-nowrap text-[14px] font-bold tracking-tight text-ink-85"
            style={{
              maxWidth: collapsed ? 0 : '140px',
              opacity: collapsed ? 0 : 1,
              paddingLeft: collapsed ? 0 : '10px',
              transition:
                'max-width 420ms cubic-bezier(0.2,0.8,0.2,1), opacity 280ms ease, padding-left 420ms cubic-bezier(0.2,0.8,0.2,1)',
            }}
          >
            SoundCloud
          </span>
        </div>
        <NavButtons />
      </div>

      <div className="flex-1 flex justify-center min-w-0" data-tauri-drag-region>
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <SchemeToggle />
        <WindowControls />
      </div>
    </div>
  );
});
