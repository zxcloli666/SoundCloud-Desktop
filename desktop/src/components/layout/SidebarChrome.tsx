import type React from 'react';

export const ROW =
  'group relative w-full flex items-center h-10 rounded-xl transition-all duration-200';
const LABEL_T = 'max-width 320ms cubic-bezier(0.2,0.8,0.2,1), opacity 240ms ease';

export const ACTIVE: React.CSSProperties = {
  color: '#fff',
  background:
    'linear-gradient(180deg, var(--color-accent-glow), transparent), rgba(255,255,255,0.05)',
  boxShadow: '0 0 18px var(--color-accent-glow), inset 0 0.5px 0 rgba(255,255,255,0.14)',
};

export function Label({
  collapsed,
  children,
  className,
}: {
  collapsed: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`overflow-hidden whitespace-nowrap ${className ?? ''}`}
      style={{ maxWidth: collapsed ? 0 : '142px', opacity: collapsed ? 0 : 1, transition: LABEL_T }}
    >
      {children}
    </span>
  );
}

export function IconBox({ children }: { children: React.ReactNode }) {
  return <span className="w-10 shrink-0 flex items-center justify-center">{children}</span>;
}
