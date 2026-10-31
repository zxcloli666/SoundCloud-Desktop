import React from 'react';

interface Props {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
}

export const ClusterHeader = React.memo(function ClusterHeader({
  icon,
  title,
  description,
  index,
}: Props) {
  return (
    <div className="flex items-end gap-4 pl-1">
      <div
        className="relative w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 text-ink"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 55%, transparent), color-mix(in srgb, var(--color-accent) 12%, transparent))',
          border: '0.5px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
          boxShadow: '0 0 22px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
      >
        {icon}
        <span
          className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black tabular-nums text-ink-85"
          style={{
            background: 'rgb(var(--shade) / calc(0.55 * var(--shade-alpha)))',
            border: '0.5px solid color-mix(in srgb, var(--color-accent) 45%, transparent)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {index + 1}
        </span>
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <h3
          className="text-[15px] md:text-[16px] font-black tracking-tight leading-none text-ink"
          style={{ textShadow: '0 0 24px var(--color-accent-glow)' }}
        >
          {title}
        </h3>
        <p className="text-[11.5px] text-ink-45 leading-snug">{description}</p>
      </div>
      <div
        className="hidden md:block flex-1 h-px self-end mb-1.5"
        style={{
          background:
            'linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 35%, transparent), transparent)',
        }}
      />
    </div>
  );
});
