import { getCurrentWindow } from '@tauri-apps/api/window';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { isDesignPreview } from '../../lib/design-preview';
import { ChevronLeft, ChevronRight, Fullscreen, Minus, Square, X } from '../../lib/icons';
import { toggleWindowFullscreen } from '../../lib/window';
import { GlobalSearch } from './GlobalSearch';

const navClass = 'sonveil-title-button disabled:cursor-default disabled:opacity-20';

const isInteractiveTitlebarTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      'button, input, textarea, select, a, [role="button"], [contenteditable="true"], .sonveil-title-search',
    ),
  );

const NavButtons = React.memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.key !== 'default';

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={!canGoBack}
        onClick={() => navigate(-1)}
        className={navClass}
        aria-label={t('common.back')}
      >
        <ChevronLeft size={17} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={() => navigate(1)}
        className={navClass}
        aria-label={t('common.forward')}
      >
        <ChevronRight size={17} strokeWidth={1.8} />
      </button>
    </div>
  );
});

function WindowButton({
  onClick,
  danger,
  label,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`sonveil-window-button${danger ? ' is-danger' : ''}`}
    >
      {children}
    </button>
  );
}

export const Titlebar = React.memo(() => {
  const { t } = useTranslation();
  const win = isDesignPreview() ? null : getCurrentWindow();

  const handleMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || !win || isInteractiveTitlebarTarget(event.target)) return;
    event.preventDefault();
    void win.startDragging();
  };

  return (
    <header className="sonveil-titlebar" onMouseDown={handleMouseDown}>
      <NavButtons />
      <div className="sonveil-title-search">
        <GlobalSearch />
      </div>
      <div className="sonveil-window-controls">
        <div className="flex items-center">
          <WindowButton onClick={() => void toggleWindowFullscreen()} label={t('kb.fullscreen')}>
            <Fullscreen size={12} />
          </WindowButton>
          <WindowButton onClick={() => void win?.minimize()} label={t('window.minimize')}>
            <Minus size={14} />
          </WindowButton>
          <WindowButton onClick={() => void win?.toggleMaximize()} label={t('window.maximize')}>
            <Square size={11} />
          </WindowButton>
          <WindowButton onClick={() => void win?.close()} danger label={t('window.close')}>
            <X size={14} />
          </WindowButton>
        </div>
      </div>
    </header>
  );
});
