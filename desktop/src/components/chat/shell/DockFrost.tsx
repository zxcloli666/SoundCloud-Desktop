import { memo } from 'react';

export const DockFrost = memo(function DockFrost() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 border-l border-[color:var(--shell-line)] bg-[var(--shell-side)]"
    />
  );
});
