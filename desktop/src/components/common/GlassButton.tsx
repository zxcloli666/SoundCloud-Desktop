import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'ghost' | 'primary' | 'icon';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  active?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer select-none disabled:opacity-40 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  ghost:
    'px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-glass-hover active:bg-bg-glass-active',
  primary:
    'px-5 py-2.5 text-sm bg-accent text-white hover:bg-accent-hover active:scale-[0.97] shadow-[0_0_20px_var(--color-accent-glow)]',
  icon: 'w-9 h-9 text-text-secondary hover:text-text-primary hover:bg-bg-glass-hover active:bg-bg-glass-active rounded-lg',
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
      className={`${base} ${variants[variant]} ${active ? 'text-text-primary bg-bg-glass-hover' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
