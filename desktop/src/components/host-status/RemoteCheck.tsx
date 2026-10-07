import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RemoteVerdict } from '../../lib/host-status';

const TONE: Record<RemoteVerdict, { dot: string; glow: string; text: string }> = {
  up: { dot: 'bg-emerald-400', glow: '0 0 8px rgba(52,211,153,0.7)', text: 'text-emerald-300/90' },
  down: { dot: 'bg-red-400', glow: '0 0 8px rgba(248,113,113,0.7)', text: 'text-red-300/90' },
  unknown: { dot: 'bg-white/30', glow: 'none', text: 'text-white/45' },
};

export const RemoteCheck = React.memo(({ verdict }: { verdict: RemoteVerdict }) => {
  const { t } = useTranslation();
  const tone = TONE[verdict];
  return (
    <div
      className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
        border: '0.5px solid rgba(255,255,255,0.08)',
      }}
    >
      <span className="relative flex w-2 h-2 shrink-0">
        {verdict !== 'unknown' && (
          <span className={`absolute inset-0 rounded-full ${tone.dot} opacity-60 animate-ping`} />
        )}
        <span
          className={`relative w-2 h-2 rounded-full ${tone.dot}`}
          style={{ boxShadow: tone.glow }}
        />
      </span>
      <span className={`text-[11px] font-medium ${tone.text}`}>
        {t(`hostStatus.remote.${verdict}`)}
      </span>
    </div>
  );
});
