import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from '../../lib/icons';
import { agoOf, type SyncEntry } from '../../lib/import-sync';
import { usePremium } from '../../lib/premium-cache';
import { useImportSyncStore } from '../../stores/import-sync';
import { StarCta } from '../star-moments/StarCta';
import { ImportSyncReconnect } from './ImportSyncReconnect';

const LINK =
  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold text-accent transition-colors hover:bg-accent/10 cursor-pointer disabled:opacity-40 disabled:cursor-default';

export function ImportSyncStatus({ entry }: { entry: SyncEntry }) {
  const { t, i18n } = useTranslation();
  const premium = usePremium();
  const running = useImportSyncStore((s) => s.running === entry.id);
  const busy = useImportSyncStore((s) => s.running !== null);
  const syncNow = useImportSyncStore((s) => s.syncNow);
  const reconnect = useImportSyncStore((s) => s.reconnect);

  if (!entry.enabled) return null;

  if (!premium) {
    return (
      <div className="flex items-center gap-2 text-[11.5px] text-ink-45">
        <span className="min-w-0 flex-1">{t('importer.sync.paused')}</span>
        <StarCta intent="extend" size="sm" />
      </div>
    );
  }

  if (entry.error === 'ym_token_invalid') {
    return (
      <div className="space-y-1.5">
        <p className="text-[11.5px] text-bad">{t('importer.sync.needsReconnect')}</p>
        <ImportSyncReconnect onSubmit={(token) => void reconnect(entry.id, token)} />
      </div>
    );
  }

  const failed = entry.error;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-45">
      {running ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin" />
          {t('importer.step.syncing')}
        </span>
      ) : failed ? (
        <span className="text-bad">
          {t(`importer.err.${entry.error}`, { defaultValue: t('importer.err.unknown') })}
        </span>
      ) : (
        <span>{t('importer.sync.last', { when: agoOf(entry.lastAt, i18n.language) })}</span>
      )}
      {entry.fresh > 0 && (
        <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-accent">
          {t('importer.sync.new', { count: entry.fresh })}
        </span>
      )}
      <button type="button" className={LINK} disabled={busy} onClick={() => void syncNow(entry.id)}>
        <RefreshCw size={11} />
        {failed ? t('importer.action.retry') : t('importer.sync.now')}
      </button>
    </div>
  );
}
