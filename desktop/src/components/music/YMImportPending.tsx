import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { askRelogin } from '../../lib/auth-recovery';
import { Lock, RotateCcw } from '../../lib/icons';
import { SYNC_STATUS_CACHE_MS, useSyncRetry, useSyncStatus } from '../../lib/sync-status';
import { useYmImportStore, type YmPendingCreate, ymPendingStateOf } from '../../stores/ym-import';

const ACTION =
  'mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink/[0.08] bg-ink/[0.05] px-3 py-1.5 text-[12px] font-semibold text-ink-75 transition-colors hover:bg-ink/[0.09] hover:text-ink-95 disabled:cursor-default disabled:opacity-40';

export function YMImportPending({ live }: { live: boolean }) {
  const { t } = useTranslation();
  const { pendingState, pendingCreates, savedAt } = useYmImportStore(
    useShallow((state) => ({
      pendingState: state.pendingState,
      pendingCreates: state.pendingCreates,
      savedAt: state.savedAt,
    })),
  );
  const { data: sync, dataUpdatedAt } = useSyncStatus({
    enabled: live && pendingCreates.length > 0,
  });
  const { retry, cooling } = useSyncRetry();

  const serverCreates = sync?.playlistCreatesTruncated ? null : sync?.playlistCreates;
  const seesSave = dataUpdatedAt - savedAt > SYNC_STATUS_CACHE_MS;
  const creates: YmPendingCreate[] = serverCreates
    ? pendingCreates.flatMap((create) => {
        const server = serverCreates.find((row) => row.title === create.title);
        if (server) return [{ ...create, targetUrn: server.targetUrn, state: server.state }];
        return seesSave ? [] : [create];
      })
    : pendingCreates;
  const state = sync ? ymPendingStateOf(creates, sync.needsRelogin) : pendingState;

  if (state === 'relogin') {
    return (
      <div>
        <p className="text-[12px] text-amber-200/80">{t('ym.relogin')}</p>
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
            {t('ym.createFailed', { title: create.title })}
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
    return <p className="text-[12px] text-amber-200/80">{t('ym.delayed')}</p>;
  }
  if (state === 'queued') {
    return <p className="text-[12px] text-ink-50">{t('ym.pending')}</p>;
  }
  return null;
}
