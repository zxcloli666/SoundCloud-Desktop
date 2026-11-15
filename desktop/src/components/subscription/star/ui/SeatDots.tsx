import { memo } from 'react';

export const SeatDots = memo(function SeatDots({ used, total }: { used: number; total: number }) {
  return (
    <span className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="size-2.5 rounded-full"
          style={{ background: i < used ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.14)' }}
        />
      ))}
    </span>
  );
});
