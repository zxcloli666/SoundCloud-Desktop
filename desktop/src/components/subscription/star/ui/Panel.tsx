import { memo, type ReactNode } from 'react';

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
      className={`panel ${pad ? 'p-4 sm:p-5' : ''} ${className}`}
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
