import { type CSSProperties, memo, type ReactNode } from 'react';

const TONE = {
  primary: 'text-accent-contrast hover:-translate-y-px',
  ghost: 'border border-ink/[0.10] bg-ink/[0.05] text-ink-85 hover:bg-ink/[0.09] hover:text-ink',
  quiet: 'text-ink-50 hover:bg-ink/[0.05] hover:text-ink-90',
  bad: 'border border-bad/40 bg-bad/[0.08] text-bad hover:bg-bad/[0.14]',
} as const;

const SIZE = {
  sm: 'h-8 rounded-[10px] px-3 text-[12px]',
  md: 'h-10 rounded-[12px] px-4 text-[13px]',
  lg: 'h-12 rounded-[14px] px-5 text-[14px]',
} as const;

const PRIMARY: CSSProperties = {
  background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
  boxShadow: '0 10px 28px -12px var(--color-accent), inset 0 1px 0 rgba(255,255,255,0.35)',
};

export const Btn = memo(function Btn({
  children,
  onClick,
  tone = 'ghost',
  size = 'md',
  wide = false,
  disabled = false,
  submit = false,
  act,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: keyof typeof TONE;
  size?: keyof typeof SIZE;
  wide?: boolean;
  disabled?: boolean;
  submit?: boolean;
  act?: string;
}) {
  return (
    <button
      type={submit ? 'submit' : 'button'}
      disabled={disabled}
      data-star-act={act}
      onClick={onClick}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[transform,background-color,color,opacity] duration-200 ease-[var(--ease-apple)] active:scale-[0.97] disabled:cursor-default disabled:opacity-45 ${SIZE[size]} ${TONE[tone]} ${wide ? 'w-full' : ''}`}
      style={tone === 'primary' ? PRIMARY : undefined}
    >
      {children}
    </button>
  );
});
