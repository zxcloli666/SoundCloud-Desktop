import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLines, Music, RefreshCw } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { usePremium } from '../../lib/premium-cache';
import { passDate } from '../../lib/star-format';
import { usePaySubscription } from '../../lib/star-offer';
import { useStarMoments } from '../../stores/star-moments';
import { Modal, ModalContent, ModalTitle } from '../ui/Modal';
import { StarCta } from './StarCta';

const RECENT_SEC = 30 * 86_400;
const SETTLE_MS = 4_000;

/** STAR just ran out: side by side, what the pass gave and what is left without it. */
export const WinbackSheet = memo(function WinbackSheet() {
  const premium = usePremium();
  const { data } = usePaySubscription(!premium);
  const seen = useStarMoments((s) => s.seen);
  const mark = useStarMoments((s) => s.mark);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(id);
  }, []);

  const endedAt = data?.last_ended_at ?? 0;
  const key = `winback:${endedAt}`;
  const recent = endedAt > 0 && Date.now() / 1000 - endedAt < RECENT_SEC;
  const open = settled && !premium && !!data && !data.premium && recent && !seen.includes(key);
  if (!open) return null;

  return (
    <Modal open onOpenChange={(next) => !next && mark(key)}>
      <ModalContent size="md">
        <WinbackBody endedAt={endedAt} onDone={() => mark(key)} />
      </ModalContent>
    </Modal>
  );
});

const ROWS = [
  { key: 'sound', Icon: AudioLines, star: 1, free: 0.62 },
  { key: 'goPlus', Icon: Music, star: 1, free: 0.12 },
  { key: 'sync', Icon: RefreshCw, star: 1, free: 0.18 },
] as const;

const WinbackBody = memo(function WinbackBody({
  endedAt,
  onDone,
}: {
  endedAt: number;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();

  return (
    <div className="relative px-7 pb-7 pt-8">
      {perf.bloom && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-36 w-72 rounded-full opacity-40"
          style={{
            background: 'radial-gradient(closest-side, var(--color-accent-glow), transparent)',
            contain: 'strict',
            transform: 'translateX(-50%) translateZ(0)',
          }}
        />
      )}
      <div className="relative" style={{ isolation: 'isolate' }}>
        <div className="flex flex-col items-center text-center">
          <span
            className="text-[40px] leading-none text-ink-25"
            style={{ filter: 'grayscale(1)' }}
          >
            ✦
          </span>
          <ModalTitle className="mt-3 text-[22px] font-black tracking-tight text-ink-95">
            {t('starMoments.winback.title')}
          </ModalTitle>
          <div className="mt-1 font-mono text-[11px] tracking-[0.12em] text-ink-35">
            {passDate(endedAt)}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3.5">
          {ROWS.map(({ key, Icon, star, free }) => (
            <div key={key} className="grid grid-cols-[28px_1fr] items-center gap-x-3 gap-y-1">
              <span className="row-span-2 grid size-7 place-items-center rounded-[8px] bg-ink/[0.05]">
                <Icon size={14} className="text-ink-60" />
              </span>
              <Lane share={star} label={t(`starMoments.winback.${key}.star`)} lit />
              <Lane share={free} label={t(`starMoments.winback.${key}.free`)} />
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <StarCta intent="buy" onOpen={onDone} />
          <button
            type="button"
            onClick={onDone}
            className="cursor-pointer rounded-full px-4 py-2 text-[12.5px] font-semibold text-ink-45 transition-colors hover:text-ink-85"
          >
            {t('starMoments.later')}
          </button>
        </div>
      </div>
    </div>
  );
});

const Lane = memo(function Lane({
  share,
  label,
  lit = false,
}: {
  share: number;
  label: string;
  lit?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.05]">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${share * 100}%`,
            background: lit ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.28)',
            boxShadow: lit ? '0 0 10px var(--color-accent-glow)' : undefined,
          }}
        />
      </div>
      <span
        className={`w-[72px] shrink-0 text-right font-mono text-[10.5px] ${lit ? 'text-accent' : 'text-ink-40'}`}
      >
        {label}
      </span>
    </div>
  );
});
