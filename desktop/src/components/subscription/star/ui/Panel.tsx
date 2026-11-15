import { memo, type ReactNode } from 'react';

const SHADOW = {
  boxShadow: '0 20px 50px -34px rgb(var(--shade) / calc(0.9 * var(--shade-alpha)))',
};

export const Panel = memo(function Panel({
  children,
  className = '',
  'data-ui': ui,
  step,
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  'data-ui'?: string;
  step?: string;
  pad?: boolean;
}) {
  return (
    <section
      data-ui={ui}
      data-step={step}
      className={`rounded-[20px] border border-ink/[0.08] bg-surface/70 ${pad ? 'p-4 sm:p-5' : ''} ${className}`}
      style={SHADOW}
    >
      {children}
    </section>
  );
});

export const Label = memo(function Label({ children }: { children: ReactNode }) {
  return <div className="mb-2.5 text-[12px] font-semibold text-ink-45">{children}</div>;
});

export const Title = memo(function Title({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-[18px] font-extrabold leading-tight tracking-tight text-ink">
        {children}
      </h2>
      {sub && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-50">{sub}</p>}
    </div>
  );
});
