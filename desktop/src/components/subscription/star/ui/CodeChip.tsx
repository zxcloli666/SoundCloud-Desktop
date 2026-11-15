import { memo } from 'react';

export const CodeChip = memo(function CodeChip({
  code,
  big = false,
}: {
  code: string;
  big?: boolean;
}) {
  return (
    <span
      className={`selectable inline-flex items-center rounded-[12px] font-mono font-semibold text-ink ${big ? 'h-12 px-4 text-[20px] tracking-[0.16em]' : 'h-10 px-3.5 text-[15px] tracking-[0.12em]'}`}
      style={{
        background: 'color-mix(in srgb, var(--color-accent) 8%, rgb(var(--ink) / 0.03))',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 30%, transparent)',
      }}
    >
      {code}
    </span>
  );
});
