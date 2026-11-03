import type {ReactNode} from 'react';
import React from 'react';

/** Рамка участка реки: заголовок + «почему это здесь». Узлы и ветки рисует
 *  RiverBraid по якорю-обёртке секции — здесь только контент. */
export const RiverSection = React.memo(function RiverSection({
  title,
  why,
  tone = 'open',
  children,
}: {
  title: string;
  why: string;
  tone?: 'open' | 'panel' | 'deep';
  children: ReactNode;
}) {
  const head = (
    <div className="mb-4">
      <h2 className="text-[21px] font-bold leading-tight tracking-[-0.015em] text-ink-92">
        {title}
      </h2>
      <p className="mt-1 text-[13px] leading-snug text-ink-50">{why}</p>
    </div>
  );

  if (tone === 'open') {
    return (
      <section className="min-w-0">
        {head}
        {children}
      </section>
    );
  }

  return (
    <section className="min-w-0">
      {head}
      <div
        className={`rounded-2xl border p-4 ${
          tone === 'deep'
            ? 'border-ink/[0.05] bg-[rgb(var(--paper)/0.55)]'
            : 'border-ink/[0.07] bg-ink/[0.025]'
        }`}
      >
        {children}
      </div>
    </section>
  );
});
