import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownToLine,
  Download,
  Globe,
  LinkIcon,
  Lock,
  TriangleAlert,
  X,
} from '../../lib/icons';
import { type TargetCheck, type Tone, useNetCheckStore } from '../../lib/net/check';
import { COLUMNS, type Column, cellTitle, volumeTitle, volumeTone } from '../../lib/net/manual';
import { Skeleton } from '../ui/Skeleton';

type Shown = Column | 'vol';

const ICONS: Record<Shown, typeof Globe> = {
  dns: Globe,
  tcp: LinkIcon,
  tls: Lock,
  http: ArrowDownToLine,
  vol: Download,
};
const SHOWN: readonly Shown[] = [...COLUMNS, 'vol'];

const MARKS: Partial<Record<Tone, typeof Globe>> = {
  warn: TriangleAlert,
  fail: X,
};

const TONES: Record<Exclude<Tone, 'pending'>, string> = {
  ok: 'text-emerald-300/80',
  warn: 'text-amber-300/85',
  fail: 'text-rose-300/85',
  skip: 'text-white/15',
};

const Cell = React.memo(({ col, tone, title }: { col: Shown; tone: Tone; title: string }) => {
  const Icon = MARKS[tone] ?? ICONS[col];
  return (
    <span className="w-7 flex justify-center" title={title} role="img" aria-label={title}>
      {tone === 'pending' ? (
        <Skeleton rounded="full" className="w-3 h-3" />
      ) : (
        <Icon size={13} className={TONES[tone]} />
      )}
    </span>
  );
});

const TargetRow = React.memo(({ target }: { target: TargetCheck }) => {
  const { t } = useTranslation();
  const ms = target.totalMs;
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium text-white/75">
          {t(`netCheck.host.${target.id}`, { node: target.node ?? '' })}
        </div>
        <div className="truncate font-mono text-[10.5px] text-white/30">{target.host}</div>
      </div>
      <div className="flex shrink-0">
        {COLUMNS.map((col, index) => (
          <Cell key={col} col={col} tone={target.cells[index]} title={cellTitle(t, col, target)} />
        ))}
        <Cell col="vol" tone={volumeTone(target)} title={volumeTitle(t, target)} />
      </div>
      <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-white/40">
        {ms === null ? '—' : t('netCheck.detail.ms', { ms })}
      </span>
    </div>
  );
});

export const HostRows = React.memo(() => {
  const { t } = useTranslation();
  const targets = useNetCheckStore((s) => s.report?.targets);
  if (!targets?.length) return null;
  return (
    <div className="mt-5 rounded-2xl bg-black/20 border border-white/[0.06] divide-y divide-white/[0.04]">
      <div className="flex items-center gap-3 px-3.5 py-2">
        <span className="flex-1" />
        <div className="flex shrink-0">
          {SHOWN.map((col) => (
            <span
              key={col}
              className="w-7 text-center font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/30"
            >
              {t(`netCheck.col.${col}`)}
            </span>
          ))}
        </div>
        <span className="w-14 shrink-0" />
      </div>
      {targets.map((target) => (
        <TargetRow key={target.host} target={target} />
      ))}
    </div>
  );
});
