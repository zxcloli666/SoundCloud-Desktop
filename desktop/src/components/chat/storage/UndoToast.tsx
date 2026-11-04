import { type CSSProperties, memo, type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Loader2, TriangleAlert, X } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { useFormatSize } from './bytes';
import { type UndoEntry, type UndoOutcome, useDeleteStore } from './delete-store';
import { errorText } from './error-text';
import { Undo2 } from './icons';
import { useReducedMotion } from './motion';

const RING = 30;
const STROKE = 2.5;
const OUTCOME_MS = 6000;

function useSecondsLeft(deadline: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

function Countdown({ entry }: { entry: UndoEntry }) {
  const reduced = useReducedMotion();
  const seconds = useSecondsLeft(entry.deadline);
  const radius = (RING - STROKE) / 2;
  const length = 2 * Math.PI * radius;
  const total = Math.max(1, entry.deadline - entry.startedAt);
  const [left] = useState(() => Math.max(0, entry.deadline - Date.now()));
  const expire = useDeleteStore((state) => state.expire);

  useEffect(() => {
    const timer = window.setTimeout(
      () => expire(entry.key),
      Math.max(0, entry.deadline - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [entry.key, entry.deadline, expire]);

  return (
    <span
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: RING, height: RING }}
    >
      <svg width={RING} height={RING} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--ink) / 0.1)"
          strokeWidth={STROKE}
        />
        <circle
          key={entry.key}
          cx={RING / 2}
          cy={RING / 2}
          r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - (reduced ? seconds * 1000 : left) / total)}
          className="storage-motion"
          style={
            reduced
              ? undefined
              : ({
                  '--storage-drain-length': `${length}px`,
                  animation: `storage-drain ${left}ms linear forwards`,
                } as CSSProperties)
          }
        />
      </svg>
      <span className="text-[11px] font-bold tabular-nums text-ink-85">{seconds}</span>
    </span>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const blur = usePerfMode().blur(24);
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      data-ui="chat-storage-undo"
      className="fixed bottom-[132px] left-1/2 z-[80] w-[min(460px,calc(100vw-32px))] -translate-x-1/2"
    >
      <div
        className="flex items-center gap-3 rounded-[1.25rem] border border-ink/[0.1] px-3.5 py-3 storage-motion"
        style={{
          animation: 'storage-rise 320ms var(--ease-apple) both',
          background: blur > 0 ? 'rgb(var(--surface) / 0.82)' : 'rgb(var(--surface) / 0.98)',
          backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.5)` : undefined,
          WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.5)` : undefined,
          boxShadow:
            '0 24px 70px -24px rgb(var(--shade) / calc(0.9 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function UndoLine({ entry, outcome }: { entry: UndoEntry; outcome: UndoOutcome | null }) {
  const { t } = useTranslation();
  const format = useFormatSize();
  const restoring = useDeleteStore((state) => state.restoring);
  const restore = useDeleteStore((state) => state.restore);
  const problem = outcome && outcome.kind !== 'restored' ? outcome : null;

  return (
    <Shell>
      <Countdown entry={entry} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold text-ink-90">
          {t('chat.storage.undo.deleted', { count: entry.count })}
        </span>
        <span className={`truncate text-[11.5px] ${problem ? 'text-bad' : 'text-ink-50'}`}>
          {problem?.kind === 'quota'
            ? t('chat.storage.undo.quota', {
                used: format(problem.used),
                quota: format(problem.quota),
              })
            : problem?.kind === 'failed'
              ? errorText(problem.error, t)
              : t('chat.storage.undo.freed', { size: format(entry.freed) })}
        </span>
      </span>
      <button
        type="button"
        disabled={restoring}
        onClick={() => void restore()}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-contrast outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface))] disabled:opacity-60"
      >
        {restoring ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
        {problem ? t('chat.storage.retry') : t('chat.storage.undo.action')}
      </button>
    </Shell>
  );
}

function OutcomeLine({ outcome }: { outcome: UndoOutcome }) {
  const { t } = useTranslation();
  const format = useFormatSize();
  const dismiss = useDeleteStore((state) => state.dismissOutcome);

  useEffect(() => {
    const timer = window.setTimeout(dismiss, OUTCOME_MS);
    return () => window.clearTimeout(timer);
  }, [dismiss]);

  const good = outcome.kind === 'restored' && outcome.missed === 0;
  let text: string;
  if (outcome.kind === 'restored') {
    text =
      outcome.missed > 0
        ? t('chat.storage.undo.missed', { restored: outcome.restored, count: outcome.missed })
        : t('chat.storage.undo.restored', { count: outcome.restored });
  } else if (outcome.kind === 'quota') {
    text = t('chat.storage.undo.quota', {
      used: format(outcome.used),
      quota: format(outcome.quota),
    });
  } else {
    text = errorText(outcome.error, t);
  }

  return (
    <Shell>
      <span className={`shrink-0 ${good ? 'text-ok' : 'text-bad'}`}>
        {good ? <CircleCheck size={18} /> : <TriangleAlert size={18} />}
      </span>
      <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-ink-85">
        {text}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('chat.storage.close')}
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-ink-40 outline-none transition-colors hover:bg-ink/[0.06] hover:text-ink-80 focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <X size={14} />
      </button>
    </Shell>
  );
}

export const UndoToast = memo(function UndoToast() {
  const undo = useDeleteStore((state) => state.undo);
  const outcome = useDeleteStore((state) => state.outcome);
  if (undo) return <UndoLine key={undo.key} entry={undo} outcome={outcome} />;
  if (outcome) return <OutcomeLine outcome={outcome} />;
  return null;
});
