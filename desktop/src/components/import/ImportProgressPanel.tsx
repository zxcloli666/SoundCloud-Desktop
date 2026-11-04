import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { Check, Loader2 } from '../../lib/icons';
import { type ImportStage, importStageOf, useImportStore } from '../../stores/import';
import { ImportBar } from './ImportBar';
import { etaOf, formatEta } from './importFormat';

const STEPS = ['reading', 'matching', 'review', 'saving'] as const;

function Steps({ active }: { active: number }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, index) => (
        <div key={step} className="flex flex-1 items-center gap-2 last:flex-none">
          <div
            className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] transition-colors duration-500 ${
              index < active
                ? 'border-accent/30 bg-accent/20 text-accent'
                : index === active
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-ink/[0.08] text-ink-30'
            }`}
          >
            {index < active ? (
              <Check size={12} />
            ) : index === active && step !== 'review' ? (
              <Loader2 size={12} className="animate-spin motion-reduce:animate-none" />
            ) : (
              index + 1
            )}
          </div>
          <span
            className={`hidden text-[12px] font-medium sm:block ${index === active ? 'text-ink-85' : 'text-ink-40'}`}
          >
            {t(`importer.step.${step}`)}
          </span>
          {index < STEPS.length - 1 && (
            <div
              className={`h-px flex-1 transition-colors duration-500 ${index < active ? 'bg-accent/40' : 'bg-ink/[0.08]'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function ImportProgressPanel() {
  const { t } = useTranslation();
  const { stage, progress, startedAt, saveDone, saveTotal, found, missed } = useImportStore(
    useShallow((state) => {
      const matched = state.rows.filter((row) => row.urn).length;
      const settled =
        state.phase === 'review' || state.phase === 'saving' || state.phase === 'done';
      return {
        stage: importStageOf(state),
        progress: state.progress,
        found: settled ? matched : (state.progress?.found ?? 0),
        missed: settled ? state.rows.length - matched : (state.progress?.not_found ?? 0),
        startedAt: state.startedAt,
        saveDone: state.saveDone,
        saveTotal: state.saveTotal,
      };
    }),
  );

  if (!stage) return null;

  const active =
    stage === 'done' ? STEPS.length : STEPS.indexOf(stage as Exclude<ImportStage, 'done'>);
  const saving = stage === 'saving';
  const current = saving ? saveDone : (progress?.current ?? 0);
  const total = saving ? saveTotal : (progress?.total ?? 0);
  const indeterminate = stage === 'reading' && total === 0;
  const pct =
    stage === 'review' || stage === 'done' ? 100 : total > 0 ? (current / total) * 100 : 0;
  const eta = stage === 'matching' ? etaOf(startedAt, current, total) : null;

  return (
    <div className="space-y-3">
      <Steps active={active} />
      <ImportBar pct={pct} indeterminate={indeterminate} className="h-2 w-full" />
      <div className="flex min-h-[18px] items-center justify-between text-[12px] text-ink-40">
        <span className="font-mono tabular-nums">
          {total > 0 && `${current} / ${total}`}
          {eta !== null && <span className="ml-2 text-ink-30">~{formatEta(eta)}</span>}
        </span>
        {progress && stage !== 'reading' && (
          <span className="flex gap-3 tabular-nums">
            <span className="text-green-400">
              {t('importer.found')}: {found}
            </span>
            <span className="text-red-400">
              {t('importer.notFound')}: {missed}
            </span>
          </span>
        )}
      </div>
      {progress?.partial && (
        <p className="text-[12px] text-amber-300/80">{t('importer.partialSource')}</p>
      )}
    </div>
  );
}
