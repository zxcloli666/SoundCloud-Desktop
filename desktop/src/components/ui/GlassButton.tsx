import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'ghost' | 'primary' | 'icon';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  active?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer select-none disabled:opacity-40 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  ghost:
    'liquid-control px-3 py-2 text-sm text-text-secondary hover:text-text-primary active:scale-[0.98]',
  primary: 'liquid-button-primary px-5 py-2.5 text-sm text-accent-contrast active:scale-[0.97]',
  icon: 'liquid-control w-9 h-9 text-text-secondary hover:text-text-primary active:scale-[0.97] rounded-full',
};

export function GlassButton({
  children,
  variant = 'ghost',
  active = false,
  className = '',
  ...props
}: GlassButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${active ? 'text-text-primary bg-bg-glass-active' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
