import type { ReactNode } from 'react';

export function CatalogEmpty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink/[0.05] text-ink-35">
        {icon}
      </div>
      <p className="max-w-[360px] text-[13px] text-ink-45">{text}</p>
    </div>
  );
}
