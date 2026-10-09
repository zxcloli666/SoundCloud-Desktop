import type React from 'react';

export function MenuItem({
  icon,
  label,
  onSelect,
  tone = 'default',
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  active?: boolean;
}) {
  const toneCls =
    tone === 'danger'
      ? 'text-white/75 hover:text-red-300 focus:text-red-300 hover:bg-red-400/10 focus:bg-red-400/10'
      : 'text-white/75 hover:text-white focus:text-white hover:bg-white/[0.07] focus:bg-white/[0.07]';
  const iconCls = active
    ? 'text-accent'
    : tone === 'danger'
      ? 'text-white/40 group-hover/item:text-red-300 group-focus/item:text-red-300'
      : 'text-white/40 group-hover/item:text-white/85 group-focus/item:text-white/85';

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onSelect}
      onPointerMove={(e) => e.currentTarget.focus({ preventScroll: true })}
      className={`group/item flex h-9 w-full items-center gap-3 rounded-[10px] px-2.5 text-left text-[13px] font-medium outline-none transition-colors duration-150 cursor-pointer ${toneCls}`}
    >
      <span className={`flex w-4 shrink-0 justify-center transition-colors ${iconCls}`}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="mx-2 my-1 h-px bg-white/[0.06]" />;
}
