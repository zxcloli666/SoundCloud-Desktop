import { useTranslation } from 'react-i18next';
import { askRelogin } from '../../lib/auth-recovery';
import { AlertCircle, Lock, RotateCcw } from '../../lib/icons';
import { type ImportFailure, useImportStore } from '../../stores/import';

type Action = 'retry' | 'reconnect' | 'signin' | 'change';

const ACTIONS: Record<string, Action> = {
  session_expired: 'signin',
  ym_token_invalid: 'reconnect',
  source_not_found: 'change',
  source_empty: 'change',
  bad_link: 'change',
  source_unparsed: 'change',
};

const BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-ink/[0.1] bg-ink/[0.06] px-3 py-1.5 text-[12px] font-semibold text-ink-80 transition-colors hover:bg-ink/[0.1] cursor-pointer';

export function ImportErrorCard({ failure }: { failure: ImportFailure }) {
  const { t } = useTranslation();
  const kind = useImportStore((s) => s.kind);
  const { retry, discard, openDialog } = useImportStore.getState();
  const action = ACTIONS[failure.code] ?? 'retry';
  const hint = failure.code === 'source_not_found' ? `${failure.code}.${kind}` : failure.code;

  const run = () => {
    if (action === 'retry') retry();
    if (action === 'signin') askRelogin();
    if (action === 'reconnect') {
      discard();
      openDialog({ tab: 'yandex', value: '' });
    }
    if (action === 'change') discard();
  };

  return (
    <div
      role="alert"
      className="flex gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-300" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[13px] font-semibold text-red-200">
          {t(`importer.err.${failure.code}`, {
            status: failure.status,
            defaultValue: t('importer.err.unknown'),
          })}
        </p>
        <p className="text-[12px] text-ink-55">
          {t(`importer.hint.${hint}`, {
            defaultValue: t(`importer.hint.${failure.code}`, {
              defaultValue: t('importer.hint.unknown'),
            }),
          })}
        </p>
        <button type="button" onClick={run} className={`${BUTTON} mt-1.5`}>
          {action === 'signin' ? <Lock size={12} /> : <RotateCcw size={12} />}
          {t(`importer.action.${action}`)}
        </button>
      </div>
    </div>
  );
}
