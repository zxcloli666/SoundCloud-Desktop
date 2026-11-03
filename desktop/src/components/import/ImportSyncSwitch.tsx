import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2 } from '../../lib/icons';
import type { HistoryEntry } from '../../lib/import-session';
import { usePremium } from '../../lib/premium-cache';
import { useImportSyncStore } from '../../stores/import-sync';
import { LockedToggle, PremiumBadge, Toggle } from '../settings/primitives';
import { StarCta } from '../star-moments/StarCta';
import { ImportSyncStatus } from './ImportSyncStatus';

export function ImportSyncSwitch({ history }: { history: HistoryEntry }) {
  const { t } = useTranslation();
  const premium = usePremium();
  const entry = useImportSyncStore((s) => s.entries.find((item) => item.id === history.id));
  const enabling = useImportSyncStore((s) => s.enabling === history.id);
  const enable = useImportSyncStore((s) => s.enable);
  const disable = useImportSyncStore((s) => s.disable);
  const on = entry?.enabled === true;

  if (!history.sync) return null;

  const toggle = async () => {
    if (on) {
      disable(history.id);
      return;
    }
    const code = await enable(history);
    if (code) {
      toast.error(t(`importer.err.${code}`, { defaultValue: t('importer.err.unknown') }));
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] font-medium text-ink-75">
          {t('importer.sync.keep')}
          <PremiumBadge />
        </span>
        {enabling && <Loader2 size={14} className="animate-spin text-ink-40" />}
        {premium || on ? (
          <Toggle
            checked={on}
            disabled={enabling}
            label={t('importer.sync.keep')}
            onChange={() => void toggle()}
          />
        ) : (
          <>
            <LockedToggle />
            <StarCta size="sm" />
          </>
        )}
      </div>
      {entry && on && <ImportSyncStatus entry={entry} />}
    </div>
  );
}
