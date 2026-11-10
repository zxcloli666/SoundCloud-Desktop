import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { Check, Loader2, X } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { importStageOf, useImportStore } from '../../stores/import';
import { ImportBar } from './ImportBar';
import { ImportSourceIcon } from './ImportSourceIcon';
import { etaOf, formatEta } from './importFormat';

export function ImportIsland() {
  const { t } = useTranslation();
  const blur = usePerfMode().blur(30);
  const s = useImportStore(
    useShallow((state) => {
      const matched = state.rows.filter((row) => row.urn).length;
      return {
        phase: state.phase,
        stage: importStageOf(state),
        kind: state.kind,
        title: state.title || state.progress?.title || '',
        current: state.phase === 'saving' ? state.saveDone : (state.progress?.current ?? 0),
        total: state.phase === 'saving' ? state.saveTotal : (state.progress?.total ?? 0),
        found: state.phase === 'running' ? (state.progress?.found ?? 0) : matched,
        missed:
          state.phase === 'running'
            ? (state.progress?.not_found ?? 0)
            : state.rows.length - matched,
        startedAt: state.startedAt,
        open: state.dialogOpen,
      };
    }),
  );
  const openDialog = useImportStore((state) => state.openDialog);
  const discard = useImportStore((state) => state.discard);

  if (!s.stage || s.open || s.phase === 'idle' || (s.phase === 'error' && s.total === 0)) {
    return null;
  }

  const working = s.phase === 'running' || s.phase === 'stopping' || s.phase === 'saving';
  const counted = s.total > 0 || !working;
  const pct = s.total > 0 && working ? (s.current / s.total) * 100 : 100;
  const eta = s.stage === 'matching' ? etaOf(s.startedAt, s.current, s.total) : null;

  return (
    <div className="pointer-events-none fixed bottom-[128px] left-1/2 z-[70] -translate-x-1/2 animate-fade-in-up motion-reduce:animate-none">
      <div
        className="pointer-events-auto relative flex w-[380px] max-w-[92vw] items-center gap-3 overflow-hidden rounded-[22px] border border-ink/[0.14] bg-shade-25 py-2.5 pr-2.5 pl-3 shadow-[0_16px_48px_rgb(var(--shade)/calc(0.3*var(--shade-alpha)))]"
        style={
          blur > 0
            ? { backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)` }
            : { background: 'rgb(var(--surface) / 0.9)' }
        }
      >
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-ink/25" />
        <button
          type="button"
          onClick={() => openDialog()}
          aria-label={t('importer.openView')}
          className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer focus-visible:outline-none"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            {working ? (
              <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
            ) : s.stage === 'done' ? (
              <Check size={16} />
            ) : (
              <ImportSourceIcon kind={s.kind} />
            )}
          </span>
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] font-semibold text-ink-85">
                {t(`importer.step.${s.stage}`)}
                {s.title && <span className="font-normal text-ink-45"> · {s.title}</span>}
              </span>
              {s.total > 0 && (
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-60">
                  {s.current}/{s.total}
                </span>
              )}
            </span>
            <ImportBar pct={pct} indeterminate={!counted} className="h-1.5" />
            {counted && (
              <span className="flex items-center gap-3 text-[11px] tabular-nums">
                <span
                  className="flex items-center gap-1 text-green-400"
                  title={t('importer.found')}
                >
                  <Check size={11} />
                  {s.found}
                </span>
                <span
                  className="flex items-center gap-1 text-red-400"
                  title={t('importer.notFound')}
                >
                  <X size={11} />
                  {s.missed}
                </span>
                {eta !== null && <span className="text-ink-40">~{formatEta(eta)}</span>}
              </span>
            )}
          </span>
        </button>
        {s.phase === 'done' && (
          <button
            type="button"
            onClick={discard}
            aria-label={t('common.close')}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-40 transition-colors hover:bg-ink/[0.08] hover:text-ink-70 cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
