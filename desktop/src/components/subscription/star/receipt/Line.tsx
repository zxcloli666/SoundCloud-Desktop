import { memo, type ReactNode } from 'react';

export const Line = memo(function Line({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2 text-[13px]">
      <span className="shrink-0 text-ink-45">{label}</span>
      <span className="mb-[3px] min-w-3 flex-1 border-b border-dotted border-ink/15" />
      <span className="min-w-0 truncate font-semibold tabular-nums text-ink-90">{children}</span>
    </div>
  );
});
