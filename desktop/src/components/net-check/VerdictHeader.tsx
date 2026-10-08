import type { TFunction } from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  type EnvInfo,
  type Hint,
  useNetCheckStore,
  useShownVerdict,
  type Verdict,
} from '../../lib/net/check';
import { checkedTime } from '../../lib/net/manual';
import { usePerfMode } from '../../lib/perf';
import { IconTile } from '../host-status/IconTile';
import { ModalTitle } from '../ui/Modal';
import { VerdictHint } from './VerdictHint';
import { VerdictIcon, verdictTitle } from './VerdictIcon';

const MAX_CHIPS = 3;
const CALM: ReadonlySet<Verdict> = new Set(['ok', 'backupDown', 'down']);
const NO_ADDRS: string[] = [];

type ChipTone = 'amber' | 'sky';

interface Chip {
  key: string;
  tone: ChipTone;
  label: string;
}

const CHIP_TONE: Record<ChipTone, { dot: string; glow: string; text: string }> = {
  amber: { dot: 'bg-amber-400', glow: '0 0 8px rgba(251,191,36,0.7)', text: 'text-amber-300/90' },
  sky: { dot: 'bg-sky-400', glow: '0 0 8px rgba(56,189,248,0.7)', text: 'text-sky-300/90' },
};

function envChips(t: TFunction, env: EnvInfo | null, hint: Hint): Chip[] {
  if (!env) return [];
  const names = [...new Set(env.dpi.map((tool) => tool.name))];
  const chips: Chip[] = names.map((name) => ({
    key: `dpi-${name}`,
    tone: 'amber',
    label: t('netCheck.env.dpi', { name }),
  }));
  if (hint === 'zapretTimestamps') {
    chips.push({ key: 'ts', tone: 'amber', label: t('netCheck.env.timestampsOff') });
  }
  if (env.proxy) chips.push({ key: 'proxy', tone: 'sky', label: t('netCheck.env.proxy') });
  if (env.vpn[0]) {
    chips.push({ key: 'vpn', tone: 'sky', label: t('netCheck.env.vpn', { name: env.vpn[0] }) });
  }
  return chips.slice(0, MAX_CHIPS);
}

const EnvChip = React.memo(({ chip }: { chip: Chip }) => {
  const perf = usePerfMode();
  const tone = CHIP_TONE[chip.tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
        border: '0.5px solid rgba(255,255,255,0.08)',
      }}
    >
      <span className="relative flex w-1.5 h-1.5 shrink-0">
        {perf.idleAnim && chip.tone === 'amber' && (
          <span className={`absolute inset-0 rounded-full ${tone.dot} opacity-60 animate-ping`} />
        )}
        <span
          className={`relative w-1.5 h-1.5 rounded-full ${tone.dot}`}
          style={{ boxShadow: tone.glow }}
        />
      </span>
      <span className={`text-[11px] font-medium ${tone.text}`}>{chip.label}</span>
    </span>
  );
});

export const VerdictHeader = React.memo(() => {
  const { t, i18n } = useTranslation();
  const report = useNetCheckStore((s) => s.report);
  const failed = useNetCheckStore((s) => s.failed);
  const verdict = useShownVerdict();
  const settled = report !== null && verdict !== 'checking' && report.verdict === verdict;
  const hint = settled ? report.hint : 'none';
  const chips = settled && !CALM.has(verdict) ? envChips(t, report.env, hint) : [];
  const time = settled ? checkedTime(report.atMs, i18n.language) : null;

  return (
    <div className="flex flex-col items-center text-center">
      <IconTile>
        <VerdictIcon verdict={verdict} size={24} />
      </IconTile>
      <ModalTitle className="text-lg font-bold text-white/90 tracking-tight">
        {verdictTitle(t, verdict)}
      </ModalTitle>
      <VerdictHint
        verdict={verdict}
        hint={hint}
        broken={failed && !settled}
        env={settled ? report.env : null}
        addrs={settled ? report.addrs : NO_ADDRS}
        backups={!settled || report.targets.some((target) => target.id === 'relay' && target.ok)}
      />
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {chips.map((chip) => (
            <EnvChip key={chip.key} chip={chip} />
          ))}
        </div>
      )}
      {time && (
        <div className="mt-3 text-[10.5px] text-white/30 font-mono">
          {t(failed ? 'netCheck.failedAt' : 'netCheck.checkedAt', { time })}
        </div>
      )}
    </div>
  );
});
