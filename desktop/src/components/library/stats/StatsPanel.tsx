import { type CSSProperties, memo, type ReactNode } from 'react';
import { type Aura, auraRgba } from '../../../lib/aura';
import { usePerfMode } from '../../../lib/perf';

export const StatsPanel = memo(function StatsPanel({
  aura,
  icon,
  title,
  aside,
  delay = 0,
  className = '',
  children,
}: {
  aura: Aura;
  icon?: ReactNode;
  title?: string;
  aside?: ReactNode;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const perf = usePerfMode();
  const blur = perf.blur(18);
  const frost: CSSProperties = {
    backdropFilter: blur > 0 ? `blur(${blur}px) saturate(140%)` : undefined,
    WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(140%)` : undefined,
    background:
      blur > 0
        ? `linear-gradient(160deg, ${auraRgba(aura, 0.07)}, rgba(12,11,16,0.5) 55%)`
        : 'rgba(14,13,18,0.92)',
  };
  return (
    <section
      className={`sp-rise relative overflow-hidden rounded-[1.75rem] p-5 md:p-6 ${className}`}
      style={{
        border: '0.5px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.32)',
        animation: `sp-rise 620ms cubic-bezier(0.2,0.8,0.2,1) ${delay.toFixed(2)}s both`,
      }}
    >
      <div className="absolute inset-0 rounded-[inherit]" style={{ contain: 'strict', ...frost }} />
      <div className="relative z-10" style={{ isolation: 'isolate' }}>
        {title && (
          <div className="flex items-center gap-2 mb-5">
            {icon && <span className="text-white/55">{icon}</span>}
            <h2 className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/50">
              {title}
            </h2>
            {aside && <div className="ml-auto min-w-0">{aside}</div>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
});
