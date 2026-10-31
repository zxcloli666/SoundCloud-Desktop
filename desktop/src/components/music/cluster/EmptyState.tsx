import React from 'react';
import { AudioLines } from '../../../lib/icons';

interface Props {
  title: string;
  description: string;
  icon?: React.ReactNode;
  cta?: string;
  onAction?: () => void;
}

export const EmptyState = React.memo(function EmptyState({
  title,
  description,
  icon,
  cta,
  onAction,
}: Props) {
  return (
    <div className="py-14 flex flex-col items-center gap-4 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          background: 'rgb(var(--ink) / 0.04)',
          border: '0.5px solid rgb(var(--ink) / 0.08)',
        }}
      >
        {icon ?? <AudioLines size={22} className="text-ink-25" />}
      </div>
      <div className="space-y-1.5 max-w-sm">
        <p className="text-[13px] font-semibold text-ink-70">{title}</p>
        <p className="text-[11.5px] text-ink-35 leading-relaxed">{description}</p>
      </div>
      {cta && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="flex h-8 cursor-pointer items-center rounded-full border border-ink/[0.08] bg-ink/[0.06] px-4 text-[12px] font-medium text-ink-70 transition-colors hover:border-ink/[0.14] hover:bg-ink/[0.1] hover:text-ink-95"
        >
          {cta}
        </button>
      )}
    </div>
  );
});
