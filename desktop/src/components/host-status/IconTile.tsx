import type { ReactNode } from 'react';

export function IconTile({ children }: { children: ReactNode }) {
  return (
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
        border: '0.5px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      {children}
    </div>
  );
}
