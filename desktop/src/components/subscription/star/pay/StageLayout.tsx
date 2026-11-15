import type { ReactNode } from 'react';

export function StageLayout({
  'data-ui': ui,
  visual,
  title,
  hint,
  aside,
  children,
}: {
  'data-ui': string;
  visual: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div data-ui={ui} className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="shrink-0">{visual}</div>
      <div className="min-w-0 flex-1 text-center sm:text-left" aria-live="polite">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
          <span className="text-[17px] font-bold leading-tight tracking-tight text-ink">
            {title}
          </span>
          {aside}
        </div>
        {hint && <div className="mt-1.5 text-[12.5px] leading-relaxed text-ink-55">{hint}</div>}
        {children && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
