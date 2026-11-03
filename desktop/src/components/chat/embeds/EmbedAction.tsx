import type React from 'react';
import type { ReactNode } from 'react';

interface EmbedActionProps {
  icon: ReactNode;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

export function EmbedAction({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
  className = '',
}: EmbedActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick(event);
      }}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-200 cursor-pointer disabled:cursor-default disabled:opacity-30 ${
        active ? 'text-accent' : 'text-ink-45 hover:bg-ink/[0.08] hover:text-ink-90'
      } ${className}`}
    >
      {icon}
    </button>
  );
}
