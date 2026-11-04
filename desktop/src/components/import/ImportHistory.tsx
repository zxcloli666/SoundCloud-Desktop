import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, X } from '../../lib/icons';
import { useImportStore } from '../../stores/import';
import { useImportSyncStore } from '../../stores/import-sync';
import { ImportSourceIcon } from './ImportSourceIcon';
import { ImportSyncSwitch } from './ImportSyncSwitch';

export function ImportHistory() {
  const { t } = useTranslation();
  const history = useImportStore((s) => s.history);
  const startImport = useImportStore((s) => s.startImport);
  const forget = useImportStore((s) => s.forgetHistory);
  const acknowledge = useImportSyncStore((s) => s.acknowledge);

  useEffect(() => acknowledge, [acknowledge]);

  if (history.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-ink/[0.06] pt-4">
      <p className="text-[12px] font-medium text-ink-60">{t('importer.history')}</p>
      <ul className="max-h-[300px] space-y-1 overflow-y-auto">
        {history.map((entry) => (
          <li
            key={entry.id}
            className="rounded-xl px-2.5 py-2 transition-colors hover:bg-ink/[0.05]"
          >
            <div className="group flex items-center gap-3">
              <span className="shrink-0 text-ink-40">
                <ImportSourceIcon kind={entry.kind} size={14} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-75">{entry.title}</span>
              <span className="shrink-0 font-mono text-[11px] text-ink-40">
                {entry.found}/{entry.total}
              </span>
              {entry.request && (
                <button
                  type="button"
                  aria-label={t('importer.rerun')}
                  title={t('importer.rerun')}
                  onClick={() => entry.request && void startImport(entry.request)}
                  className="flex size-7 items-center justify-center rounded-lg text-ink-40 transition-colors hover:bg-ink/[0.08] hover:text-ink-80 cursor-pointer"
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <button
                type="button"
                aria-label={t('importer.forget')}
                title={t('importer.forget')}
                onClick={() => forget(entry.id)}
                className="flex size-7 items-center justify-center rounded-lg text-ink-30 opacity-0 transition-all hover:bg-ink/[0.08] hover:text-ink-70 focus-visible:opacity-100 group-hover:opacity-100 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
            {entry.sync && (
              <div className="mt-2 pl-[26px]">
                <ImportSyncSwitch history={entry} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
