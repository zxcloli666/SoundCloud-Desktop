import type { ReactNode } from 'react';

export function IconTile({ children }: { children: ReactNode }) {
  return (
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
      style={{
        background: 'linear-gradient(135deg, rgb(var(--ink) / 0.06), rgb(var(--ink) / 0.02))',
        border: '0.5px solid rgb(var(--ink) / 0.08)',
        boxShadow: '0 4px 20px rgb(var(--shade) / calc(0.3 * var(--shade-alpha)))',
      }}
    >
      {children}
    </div>
  );
}
