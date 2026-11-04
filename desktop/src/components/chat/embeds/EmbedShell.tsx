import type { ReactNode, Ref } from 'react';
import { surface } from '../../../lib/chat/tone';
import type { EmbedKind } from '../../../lib/chat/types';
import type { Rgb } from '../../../lib/cover-palette';

interface EmbedShellProps {
  kind: EmbedKind;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
  tint?: Rgb | null;
  mine?: boolean;
  dim?: boolean;
  compact?: boolean;
  label?: string;
}

function background(tint: Rgb | null, mine: boolean): string {
  const base = mine ? surface(3, 32) : 'var(--color-bg-glass)';
  if (!tint) return base;
  const [r, g, b] = tint;
  return `linear-gradient(128deg, rgba(${r},${g},${b},0.22) 0%, rgba(${r},${g},${b},0.07) 46%, transparent 100%), ${base}`;
}

export function EmbedShell({
  kind,
  children,
  ref,
  tint = null,
  mine = false,
  dim = false,
  compact = false,
  label,
}: EmbedShellProps) {
  return (
    <div
      ref={ref}
      data-ui="chat-embed"
      data-kind={kind}
      role="group"
      aria-label={label}
      className={`@container relative w-full min-w-0 overflow-hidden ${
        compact ? 'rounded-[14px] p-2' : 'max-w-[360px] rounded-[18px] p-3'
      }`}
      style={{
        background: background(dim ? null : tint, mine),
        border: '0.5px solid var(--color-border-glass)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px rgba(0,0,0,0.18)',
        filter: dim ? 'grayscale(1)' : undefined,
        opacity: dim ? 0.62 : undefined,
        transition: 'opacity 400ms var(--ease-apple)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-5 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgb(var(--ink) / 0.16), transparent)',
        }}
      />
      {children}
    </div>
  );
}
