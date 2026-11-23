import type { ReactNode } from 'react';

export function ActionButton({
  icon,
  label,
  onClick,
  tone,
  disabled,
}: {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'accent' | 'danger' | 'quiet';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-tone={tone}
      className="set-btn"
    >
      {icon}
      {label}
    </button>
  );
}
