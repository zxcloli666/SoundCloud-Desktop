import { getCurrentWindow } from '@tauri-apps/api/window';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Disc3, Fullscreen, Minus, Square, X } from '../../lib/icons';
import { toggleWindowFullscreen } from '../../lib/window';

const NavButtons = React.memo(() => {
  const navigate = useNavigate();
  const location = useLocation();

  // track history length to enable/disable (basic heuristic)
  const canGoBack = location.key !== 'default';

  return (
    <div className="ml-2 flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] p-0.5 backdrop-blur-xl">
      <button
        type="button"
        disabled={!canGoBack}
        onClick={() => navigate(-1)}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white/38 transition-all duration-150 hover:bg-white/[0.10] hover:text-white/80 active:scale-90 disabled:cursor-default disabled:opacity-20"
      >
        <ChevronLeft size={14} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => navigate(1)}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white/38 transition-all duration-150 hover:bg-white/[0.10] hover:text-white/80 active:scale-90"
      >
        <ChevronRight size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
});

export const Titlebar = React.memo(() => {
  const { t } = useTranslation();
  const minimize = () => getCurrentWindow().minimize();
  const toggleMaximize = () => getCurrentWindow().toggleMaximize();
  const toggleFullscreen = () => void toggleWindowFullscreen();
  const close = () => getCurrentWindow().close();

  return (
    <div
      className="relative z-20 mx-3 mt-3 mb-2 flex h-11 shrink-0 select-none items-center justify-between rounded-full border border-white/[0.10] bg-white/[0.045] px-4 shadow-[0_14px_44px_rgba(0,0,0,0.22),inset_1px_1px_0_rgba(255,255,255,0.16)] backdrop-blur-[30px]"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-1.5" data-tauri-drag-region>
        <Disc3 size={14} className="text-accent" strokeWidth={2} />
        <span className="text-[11px] font-semibold tracking-tight text-white/48">SoundCloud</span>
        <NavButtons />
      </div>

      <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] p-0.5 backdrop-blur-xl">
        <button
          type="button"
          title={t('kb.fullscreen')}
          aria-label={t('kb.fullscreen')}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/30 transition-all duration-150 hover:bg-white/[0.10] hover:text-white/70"
          onClick={toggleFullscreen}
        >
          <Fullscreen size={12} />
        </button>
        <button
          type="button"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/30 transition-all duration-150 hover:bg-white/[0.10] hover:text-white/70"
          onClick={minimize}
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/30 transition-all duration-150 hover:bg-white/[0.10] hover:text-white/70"
          onClick={toggleMaximize}
        >
          <Square size={10} />
        </button>
        <button
          type="button"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/30 transition-all duration-150 hover:bg-red-500/15 hover:text-red-300"
          onClick={close}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
});
