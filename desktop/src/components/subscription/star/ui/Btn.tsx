import { memo, type ReactNode } from 'react';

const TONE = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-hover',
  ghost: 'border border-ink/[0.10] bg-ink/[0.05] text-ink-85 hover:bg-ink/[0.09] hover:text-ink',
  quiet: 'text-ink-50 hover:bg-ink/[0.05] hover:text-ink-90',
  bad: 'border border-bad/40 bg-bad/[0.08] text-bad hover:bg-bad/[0.14]',
} as const;

const SIZE = {
  sm: 'h-8 rounded-[10px] px-3 text-[12px]',
  md: 'h-10 rounded-[12px] px-4 text-[13px]',
  lg: 'h-12 rounded-[14px] px-5 text-[14px]',
} as const;

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
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,color,opacity] duration-200 ease-[var(--ease-apple)] active:scale-[0.97] disabled:cursor-default disabled:opacity-45 ${SIZE[size]} ${TONE[tone]} ${wide ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
});
