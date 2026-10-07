import type React from 'react';
import { splitTagInput } from '../../lib/track-edits';

export const FIELD_CLASS =
  'w-full bg-white/[0.04] text-[13.5px] text-white/90 placeholder:text-white/25 px-3.5 py-2.5 rounded-xl outline-none border border-white/[0.07] focus:border-accent/40 focus:bg-white/[0.06] transition-colors disabled:opacity-60';

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
      {children}
    </span>
  );
}

export function TagPreview({ input }: { input: string }) {
  const tags = splitTagInput(input);
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 -mt-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium text-white/60 bg-white/[0.05] border border-white/[0.07]"
        >
          #{tag}
        </span>
      ))}
    </div>
  );
}
