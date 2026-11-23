import { memo, type ReactNode } from 'react';

export const STATS_PANEL = 'panel sp-rise rounded-3xl';

export const StatsPanel = memo(function StatsPanel({
  icon,
  title,
  aside,
  delay = 0,
  className = '',
  children,
}: {
  icon?: ReactNode;
  title?: string;
  aside?: ReactNode;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`${STATS_PANEL} p-5 md:p-6 ${className}`}
      style={{ animation: `sp-rise 620ms cubic-bezier(0.2,0.8,0.2,1) ${delay.toFixed(2)}s both` }}
    >
      {title && (
        <div className="mb-5 flex items-center gap-2">
          {icon && <span className="text-ink-45">{icon}</span>}
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-45">
            {title}
          </h2>
          {aside && <div className="ml-auto min-w-0">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
});
