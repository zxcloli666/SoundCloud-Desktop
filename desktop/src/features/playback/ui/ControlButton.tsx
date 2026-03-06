import type React from 'react';

export const ControlButton = ({
  onClick,
  active = false,
  children,
  size = 'default',
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  size?: 'default' | 'sm';
}) => {
  const s = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${s} rounded-full flex items-center justify-center transition-all duration-150 ease-[var(--ease-apple)] cursor-pointer hover:bg-white/[0.04] ${
        active ? 'text-accent' : 'text-white/40 hover:text-white/70'
      }`}
    >
      {children}
    </button>
  );
};
