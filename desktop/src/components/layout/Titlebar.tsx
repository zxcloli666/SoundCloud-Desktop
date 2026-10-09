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
  RefreshCw,
  Square,
  X,
} from '../../lib/icons';
import { toggleWindowFullscreen } from '../../lib/window';
import {useSettingsStore} from '../../stores/settings';
import {GlobalSearch} from './GlobalSearch';

const navCls =
    'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-20 disabled:cursor-default text-white/45 hover:text-white hover:bg-white/[0.08] active:scale-90';

const NavButtons = React.memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.key !== 'default';
    // `/` — индекс-роут, который всегда редиректит на стартовую страницу; домашняя
    // лента живёт на `/home`. Активное состояние и навигация — по нему.
    const onHome = location.pathname === '/home';

  return (
      <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={!canGoBack}
        onClick={() => navigate(-1)}
        className={navCls}
        aria-label="Back"
      >
          <ChevronLeft size={17} strokeWidth={2.5}/>
      </button>
          <button type="button" onClick={() => navigate(1)} className={navCls} aria-label="Forward">
              <ChevronRight size={17} strokeWidth={2.5}/>
      </button>
      <button
        type="button"
        onClick={() => navigate('/home')}
        aria-label="Home"
        className={
            onHome
                ? 'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90'
                : navCls
        }
        style={
            onHome
                ? {
                    color: '#fff',
                    background:
                        'linear-gradient(180deg, var(--color-accent-glow), transparent), rgba(255,255,255,0.05)',
                    boxShadow:
                        '0 0 16px var(--color-accent-glow), inset 0 0.5px 0 rgba(255,255,255,0.14)',
                }
                : undefined
        }
      >
          <Home size={16} strokeWidth={2.2}/>
      </button>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className={navCls}
        aria-label={t('nav.reload')}
        title={t('nav.reload')}
      >
          <RefreshCw size={15} strokeWidth={2.2}/>
      </button>
    </div>
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
        className={`w-10 h-9 rounded-lg flex items-center justify-center text-white/30 transition-all duration-150 cursor-pointer ${
            danger ? 'hover:text-white hover:bg-red-500/80' : 'hover:text-white/80 hover:bg-white/[0.07]'
        }`}
    >
        {children}
    </button>
);

export const Titlebar = React.memo(() => {
  const { t } = useTranslation();
    const collapsed = useSettingsStore((s) => s.sidebarCollapsed);
    const win = getCurrentWindow();

  return (
    <div
        data-ui="titlebar"
        className="relative z-50 h-14 flex items-center gap-3 px-3 select-none shrink-0"
      data-tauri-drag-region
        style={{
            background:
                'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.014) 100%)',
            borderBottom: '0.5px solid rgba(255,255,255,0.07)',
        }}
    >
        {/* top specular sheen */}
        <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)',
            }}
        />

        {/* LEFT: logo (image) + collapsible wordmark + persistent nav */}
        <div className="flex items-center gap-3 shrink-0" data-tauri-drag-region>
            <div className="flex items-center" data-tauri-drag-region>
                <img
                    src={appIcon}
                    alt="SoundCloud"
                    draggable={false}
                    data-tauri-drag-region
                    className="w-8 h-8 rounded-[10px] shrink-0"
                    style={{
                        boxShadow:
                            '0 2px 12px var(--color-accent-glow), inset 0 0 0 0.5px rgba(255,255,255,0.1)',
                    }}
                />
                {/* Always rendered; collapses purely via CSS so there's no JS mount/unmount
              race when the sidebar toggles. max-width + padding fold the reclaimed space. */}
                <span
                    data-tauri-drag-region
                    className="overflow-hidden whitespace-nowrap text-[14px] font-bold tracking-tight text-white/85"
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

        {/* CENTER: the one global search. Drag region too — Tauri keys off e.target,
            not ancestors, so the empty space beside the centered field must carry it. */}
        <div className="flex-1 flex justify-center min-w-0" data-tauri-drag-region>
            <GlobalSearch/>
        </div>

        {/* RIGHT: window controls */}
        <div className="flex items-center gap-0.5 shrink-0">
            <WinButton onClick={() => void toggleWindowFullscreen()} label={t('kb.fullscreen')}>
                <Fullscreen size={13}/>
            </WinButton>
            <WinButton onClick={() => win.minimize()} label="Minimize">
                <Minus size={15}/>
            </WinButton>
            <WinButton onClick={() => win.toggleMaximize()} label="Maximize">
                <Square size={12}/>
            </WinButton>
            <WinButton onClick={() => win.close()} danger label="Close">
                <X size={15}/>
            </WinButton>
      </div>
    </div>
  );
});
