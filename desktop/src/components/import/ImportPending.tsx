import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { askRelogin } from '../../lib/auth-recovery';
import { Lock, RotateCcw } from '../../lib/icons';
import { type ImportPendingCreate, pendingStateOf } from '../../lib/import-save';
import { SYNC_STATUS_CACHE_MS, useSyncRetry, useSyncStatus } from '../../lib/sync-status';
import { useImportStore } from '../../stores/import';

const ACTION =
  'mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink/[0.08] bg-ink/[0.05] px-3 py-1.5 text-[12px] font-semibold text-ink-75 transition-colors hover:bg-ink/[0.09] hover:text-ink-95 disabled:cursor-default disabled:opacity-40';

const NO_CREATES: ImportPendingCreate[] = [];

export function ImportPending({ live }: { live: boolean }) {
  const { t } = useTranslation();
  const { pendingState, pendingCreates, savedAt } = useImportStore(
    useShallow((state) => ({
      pendingState: state.result?.pendingState ?? null,
      pendingCreates: state.result?.pendingCreates ?? NO_CREATES,
      savedAt: state.result?.savedAt ?? 0,
    })),
  );
  const { data: sync, dataUpdatedAt } = useSyncStatus({
    enabled: live && pendingCreates.length > 0,
  });
  const { retry, cooling } = useSyncRetry();

  const serverCreates = sync?.playlistCreatesTruncated ? null : sync?.playlistCreates;
  const seesSave = dataUpdatedAt - savedAt > SYNC_STATUS_CACHE_MS;
  const creates: ImportPendingCreate[] = serverCreates
    ? pendingCreates.flatMap((create) => {
        const server = serverCreates.find((row) => row.title === create.title);
        if (server) return [{ ...create, targetUrn: server.targetUrn, state: server.state }];
        return seesSave ? [] : [create];
      })
    : pendingCreates;
  const state = sync ? pendingStateOf(creates, sync.needsRelogin) : pendingState;

  if (state === 'relogin') {
    return (
      <div>
        <p className="text-[12px] text-amber-200/80">{t('importer.relogin')}</p>
        <button type="button" onClick={() => askRelogin()} className={ACTION}>
          <Lock size={12} />
          {t('sync.signIn')}
        </button>
      </div>
    );
  }

  if (state === 'failed') {
    const failed = creates.filter((create) => create.state === 'failed');
    const retryFailed = () => {
      for (const create of failed) if (create.targetUrn) void retry(create.targetUrn);
    };
    return (
      <div>
        {failed.map((create) => (
          <p key={create.title} className="text-[12px] text-red-300/85">
            {t('importer.createFailed', { title: create.title })}
          </p>
        ))}
        <button type="button" onClick={retryFailed} disabled={cooling} className={ACTION}>
          <RotateCcw size={12} />
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (state === 'delayed') {
    return <p className="text-[12px] text-amber-200/80">{t('importer.delayed')}</p>;
  }
  if (state === 'queued') {
    return <p className="text-[12px] text-ink-50">{t('importer.pending')}</p>;
  }
  return null;
}
