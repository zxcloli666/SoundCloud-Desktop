import type { ReactNode } from 'react';
import { AlertCircle } from '../../../lib/icons';

export function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] bg-amber-400/[0.08] px-3 py-2.5">
      <AlertCircle size={14} className="shrink-0 text-amber-400" />
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-ink-70">{children}</p>
      {action}
    </div>
  );
}
