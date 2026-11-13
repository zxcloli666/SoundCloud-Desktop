import { memo } from 'react';

export const DayCells = memo(function DayCells({ total, left }: { total: number; left: number }) {
  return (
    <div className="mt-3.5 flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-1.5 flex-1 rounded-full"
          style={{
            background: i < left ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.08)',
            boxShadow: i < left ? '0 0 10px var(--color-accent-glow)' : undefined,
          }}
        />
      ))}
    </div>
  );
});
