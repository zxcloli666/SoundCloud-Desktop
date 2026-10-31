import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';

/** Floating glass card above the player dock, bottom-right, for one STAR moment at a time. */
export const MomentCard = memo(function MomentCard({
  children,
  onClose,
  onHover,
}: {
  children: ReactNode;
  onClose: () => void;
  onHover?: (hovered: boolean) => void;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const blur = perf.blur(24);

  return (
    <div
      className="fixed bottom-[132px] right-4 z-[90] w-[min(340px,calc(100vw-32px))] animate-in fade-in slide-in-from-bottom-3 duration-500"
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <div
        className="relative overflow-hidden rounded-[20px] border border-ink/[0.10] p-4"
        style={{
          background: blur
            ? 'linear-gradient(180deg, rgb(var(--ink) / 0.06), rgb(var(--ink) / 0.01) 60%), rgb(var(--surface) / 0.78)'
            : 'rgb(var(--surface) / 0.96)',
          backdropFilter: blur ? `blur(${blur}px) saturate(1.5)` : undefined,
          WebkitBackdropFilter: blur ? `blur(${blur}px) saturate(1.5)` : undefined,
          boxShadow: '0 24px 70px -24px rgb(var(--shade) / calc(0.9 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <span
          aria-hidden
          className="absolute inset-x-6 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-accent) 70%, white), transparent)',
          }}
        />
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          className="absolute right-2.5 top-2.5 grid size-7 cursor-pointer place-items-center rounded-full text-ink-35 transition-colors hover:bg-ink/[0.06] hover:text-ink-80"
        >
          <X size={14} />
        </button>
        <div className="relative" style={{ isolation: 'isolate' }}>
          {children}
        </div>
      </div>
    </div>
  );
});
