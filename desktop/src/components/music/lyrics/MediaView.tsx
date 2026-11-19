import React, { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from '../../../lib/icons';

const SQUARE =
  'aspect-square w-[min(calc(100vw-4rem),calc(100vh-4rem))] sm:w-[min(calc(100vw-6rem),calc(100vh-6rem))]';
const WIDE =
  'aspect-video w-[min(calc(100vw-4rem),calc((100vh-12rem)*16/9))] sm:w-[min(calc(100vw-6rem),calc((100vh-12rem)*16/9))]';

export const MediaView = React.memo(
  ({
    children,
    wide,
    title,
    subtitle,
    onClose,
  }: {
    children: ReactNode;
    wide?: boolean;
    title: string;
    subtitle: string;
    onClose: () => void;
  }) => {
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      };
      window.addEventListener('keydown', onKey, true);
      return () => window.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    if (typeof document === 'undefined') return null;

    return createPortal(
      <div
        data-scheme="dark"
        className="fixed inset-0 z-[220] flex items-center justify-center bg-black/90 p-8 backdrop-blur-xl sm:p-12"
      >
        <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-ink/10 text-ink transition-all hover:bg-ink/20 cursor-pointer"
        >
          <X size={20} />
        </button>
        <div
          className={`relative z-10 max-w-full max-h-full ${wide ? WIDE : SQUARE}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-ink/10 bg-black/24 shadow-[0_32px_128px_rgb(var(--shade)/calc(0.8*var(--shade-alpha)))]">
            {children}
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 w-[min(560px,calc(100vw-3rem))] -translate-x-1/2 px-3">
          <div className="mx-auto flex w-fit max-w-full flex-col items-center gap-0.5 rounded-2xl border border-ink/10 bg-black/40 px-4 py-3 text-center shadow-[0_18px_60px_rgb(var(--shade)/calc(0.42*var(--shade-alpha)))] backdrop-blur-xl">
            <p className="max-w-[min(480px,calc(100vw-6rem))] truncate text-lg font-bold text-ink-95">
              {title}
            </p>
            <p className="max-w-[min(440px,calc(100vw-6rem))] truncate text-sm text-ink-50">
              {subtitle}
            </p>
          </div>
        </div>
      </div>,
      document.body,
    );
  },
);
