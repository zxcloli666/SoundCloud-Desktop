import type { HTMLAttributes, ReactNode } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padding?: boolean;
}

export function GlassCard({
  children,
  hover = false,
  padding = true,
  className = '',
  ...props
}: GlassCardProps) {
  return (
    <div
      className={`glass rounded-2xl ${hover ? 'glass-hover transition-all duration-200 ease-[var(--ease-apple)]' : ''} ${padding ? 'p-4' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
