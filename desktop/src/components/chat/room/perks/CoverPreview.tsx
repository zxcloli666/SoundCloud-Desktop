import { memo, type ReactNode } from 'react';
import { usePerfMode } from '../../../../lib/perf';

const LAYER = { contain: 'strict', transform: 'translateZ(0)' } as const;

export const CoverPreview = memo(function CoverPreview({
  src,
  accent,
  round,
  children,
}: {
  src: string | null;
  accent: string | null;
  round?: boolean;
  children?: ReactNode;
}) {
  const perf = usePerfMode();
  const blur = perf.blur(22);
  const tint = accent ?? 'var(--color-accent)';

  return (
    <div className="relative overflow-hidden rounded-[12px] border border-ink/[0.08]">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={LAYER}>
        {src && blur > 0 && perf.bloom && (
          <img
            key={src}
            src={src}
            alt=""
            className="absolute -inset-6 h-[calc(100%+3rem)] w-[calc(100%+3rem)] max-w-none object-cover opacity-55"
            style={{ filter: `blur(${blur}px) saturate(1.5)` }}
          />
        )}
        <div
          className="perk-motion absolute inset-0 transition-[background] duration-500"
          style={{
            background: `linear-gradient(150deg, color-mix(in srgb, ${tint} 42%, transparent), transparent 75%)`,
          }}
        />
      </div>
      <div className="relative flex items-center gap-2.5 p-2.5" style={{ isolation: 'isolate' }}>
        <div
          className={`size-12 shrink-0 overflow-hidden bg-ink/[0.08] ${round ? 'rounded-full' : 'rounded-[9px]'}`}
          style={{ boxShadow: `0 6px 18px -6px ${tint}` }}
        >
          {src && <img key={src} src={src} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
});
