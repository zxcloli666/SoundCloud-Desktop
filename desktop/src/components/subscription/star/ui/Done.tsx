import { memo, type ReactNode } from 'react';
import { PaidMark } from './Orb';

export const Done = memo(function Done({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 py-2">
      <PaidMark size={34} />
      <span className="text-[15px] font-bold text-ink">{children}</span>
    </div>
  );
});
