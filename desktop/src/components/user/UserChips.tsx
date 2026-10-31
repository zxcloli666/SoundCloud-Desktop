import React from 'react';
import { Check, Globe, Instagram, LinkIcon, Twitter, Youtube } from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';

export const VerifiedBadge = React.memo(function VerifiedBadge({ title }: { title: string }) {
  return (
    <div
      className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-ink/20 shadow-[0_0_16px_rgba(59,130,246,0.55)]"
      title={title}
    >
      <Check size={13} className="text-ink" strokeWidth={3.5} />
    </div>
  );
});

export const ProChip = React.memo(function ProChip({ plan }: { plan: string }) {
    const b = usePerfMode().blur(12);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300/90"
      style={{
          background:
              b > 0
                  ? 'linear-gradient(135deg, rgba(255,85,0,0.18), rgba(255,0,128,0.10))'
                  : 'linear-gradient(135deg, rgba(58,28,14,0.92), rgba(48,16,32,0.92))',
        border: '0.5px solid rgba(255,85,0,0.25)',
          backdropFilter: b > 0 ? `blur(${b}px)` : undefined,
          WebkitBackdropFilter: b > 0 ? `blur(${b}px)` : undefined,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_#ff5500]" />
      {plan}
    </span>
  );
});

export const InfoChip = React.memo(function InfoChip({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
    const b = usePerfMode().blur(12);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-55"
      style={{
          background: b > 0 ? 'rgb(var(--ink) / 0.04)' : 'rgb(var(--surface-hi) / 0.85)',
        border: '0.5px solid rgb(var(--ink) / 0.07)',
          backdropFilter: b > 0 ? `blur(${b}px)` : undefined,
          WebkitBackdropFilter: b > 0 ? `blur(${b}px)` : undefined,
      }}
    >
      <span className="text-ink-45">{icon}</span>
      {children}
    </span>
  );
});

export function getWebIcon(service: string) {
  switch (service.toLowerCase()) {
    case 'instagram':
      return <Instagram size={14} />;
    case 'twitter':
      return <Twitter size={14} />;
    case 'youtube':
      return <Youtube size={14} />;
    case 'personal':
      return <Globe size={14} />;
    default:
      return <LinkIcon size={14} />;
  }
}
