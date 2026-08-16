import { memo, type ReactNode } from 'react';
import { getWallpaperUrl } from '../../lib/cache';
import { usePerfMode } from '../../lib/perf';
import { useSettingsStore } from '../../stores/settings';

export const RightPanelShell = memo(function RightPanelShell({
  open,
  onClose,
  ariaLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  const perf = usePerfMode();
  const panelBlur = perf.blur(60);
  const backgroundName = useSettingsStore((state) => state.backgroundImage);
  const wallpaperUrl = backgroundName ? getWallpaperUrl(backgroundName) : null;

  return (
    <>
      <button
        type="button"
        className={`fixed inset-0 z-40 border-0 bg-black/40 p-0 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-label={ariaLabel}
        tabIndex={-1}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-[360px] max-w-full flex-col border-l border-white/[0.06]"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={{
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          visibility: open ? 'visible' : 'hidden',
          transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), visibility 300ms',
        }}
      >
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ contain: 'strict', transform: 'translateZ(0)' }}
        >
          {wallpaperUrl ? (
            <>
              <img
                src={wallpaperUrl}
                alt=""
                aria-hidden="true"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  filter: panelBlur > 0 ? `blur(${panelBlur}px) saturate(1.15)` : undefined,
                  transform: 'scale(1.15) translateZ(0)',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to left, rgba(14,14,18,${panelBlur > 0 ? 0.58 : 0.82}), rgba(14,14,18,${panelBlur > 0 ? 0.72 : 0.92}))`,
                }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: panelBlur > 0 ? 'rgba(16, 16, 20, 0.82)' : 'rgba(16, 16, 20, 0.98)',
                backdropFilter: panelBlur > 0 ? `blur(${panelBlur}px) saturate(1.6)` : undefined,
                WebkitBackdropFilter:
                  panelBlur > 0 ? `blur(${panelBlur}px) saturate(1.6)` : undefined,
              }}
            />
          )}
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-px"
          style={{
            background:
              'linear-gradient(to bottom, transparent, var(--color-accent) 45%, transparent)',
            opacity: 0.4,
          }}
        />

        <div className="relative z-10 h-full min-h-0" style={{ isolation: 'isolate' }}>
          {children}
        </div>
      </aside>
    </>
  );
});
