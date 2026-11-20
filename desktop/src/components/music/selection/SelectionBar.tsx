import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Shuffle, X } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { useTrackSelection } from '../../../stores/trackSelection';

export function SelectionBar() {
  const { t } = useTranslation();
  const blur = usePerfMode().blur(24);
  const count = useTrackSelection((s) => s.picked.length);
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname) useTrackSelection.getState().clear();
  }, [pathname]);

  useEffect(() => {
    if (count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[aria-modal="true"]')) return;
      useTrackSelection.getState().clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  if (count === 0) return null;
  const { shuffle, clear } = useTrackSelection.getState();

  return createPortal(
    <div className="fixed left-1/2 bottom-[120px] z-[90] -translate-x-1/2">
      <div
        className="flex items-center gap-2 rounded-2xl py-2 pl-4 pr-2 animate-fade-in-up"
        style={{
          border: '0.5px solid rgb(var(--ink) / 0.14)',
          background: blur ? 'rgb(var(--surface) / 0.72)' : 'rgb(var(--surface) / 0.95)',
          backdropFilter: blur ? `blur(${blur}px) saturate(1.4)` : undefined,
          WebkitBackdropFilter: blur ? `blur(${blur}px) saturate(1.4)` : undefined,
          boxShadow:
            '0 18px 50px rgb(var(--shade) / calc(0.5 * var(--shade-alpha))), 0 0 30px var(--color-accent-glow)',
        }}
      >
        <span className="min-w-6 text-center text-[15px] font-bold tabular-nums text-accent">
          {count}
        </span>
        <button
          type="button"
          onClick={shuffle}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-accent px-3.5 text-[13px] font-semibold text-accent-contrast transition-transform duration-200 ease-[var(--ease-apple)] hover:scale-[1.03] active:scale-[0.97]"
        >
          <Shuffle size={14} />
          {t('selection.shuffle')}
        </button>
        <button
          type="button"
          onClick={clear}
          title={t('selection.clear')}
          aria-label={t('selection.clear')}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-ink-55 transition-colors hover:bg-ink/[0.07] hover:text-ink-90"
        >
          <X size={15} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
