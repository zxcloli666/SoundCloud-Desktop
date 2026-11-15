import { memo, type ReactNode } from 'react';
import { TriangleAlert } from '../../../../lib/icons';

export const Alert = memo(function Alert({
  ui,
  tone,
  title,
  sub,
  bar,
  children,
}: {
  ui: string;
  tone: 'warn' | 'bad';
  title: ReactNode;
  sub?: ReactNode;
  bar?: number;
  children?: ReactNode;
}) {
  const color = tone === 'bad' ? 'rgb(var(--bad))' : 'var(--color-amber-400)';
  return (
    <div
      data-ui={ui}
      data-tone={tone}
      className="relative flex flex-wrap items-center gap-3 overflow-hidden rounded-[16px] px-4 py-3"
      style={{
        background: `color-mix(in srgb, ${color} 9%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 38%, transparent)`,
      }}
    >
      <TriangleAlert size={18} className="shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-ink-90">{title}</div>
        {sub && <div className="mt-0.5 text-[12px] tabular-nums text-ink-55">{sub}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
      {bar !== undefined && (
        <span
          className="absolute inset-x-0 bottom-0 h-[3px] origin-left"
          style={{ background: color, transform: `scaleX(${Math.min(1, Math.max(0.04, bar))})` }}
        />
      )}
    </div>
  );
});
