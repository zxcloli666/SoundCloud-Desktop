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
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold bg-white/[0.06] text-white/75 hover:bg-white/[0.1] hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 cursor-pointer"
    >
      {icon}
      {label}
    </button>
  );
}
