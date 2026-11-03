import type { ReactNode } from 'react';

export function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold bg-ink/[0.06] text-ink-75 hover:bg-ink/[0.1] hover:text-ink border border-ink/[0.06] hover:border-ink/[0.12] transition-all duration-200 cursor-pointer"
    >
      {icon}
      {label}
    </button>
  );
}
