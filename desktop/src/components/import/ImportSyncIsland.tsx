import { useTranslation } from 'react-i18next';
import { Loader2 } from '../../lib/icons';
import { useImportStore } from '../../stores/import';
import { useImportSyncStore } from '../../stores/import-sync';

export function ImportSyncIsland() {
  const { t } = useTranslation();
  const title = useImportSyncStore((s) => s.entries.find((e) => e.id === s.running)?.title);
  const idle = useImportStore((s) => s.phase === 'idle');

  if (!title || !idle) return null;

  return (
    <div className="pointer-events-none fixed bottom-[128px] left-1/2 z-[70] -translate-x-1/2 animate-fade-in-up motion-reduce:animate-none">
      <div className="flex max-w-[92vw] items-center gap-2.5 rounded-full border border-ink/[0.14] bg-surface/90 py-2 pr-4 pl-3 text-[12px] shadow-[0_12px_36px_rgb(var(--shade)/calc(0.3*var(--shade-alpha)))]">
        <Loader2 size={14} className="animate-spin text-accent motion-reduce:animate-none" />
        <span className="font-semibold text-ink-85">{t('importer.step.syncing')}</span>
        <span className="truncate text-ink-45">{title}</span>
      </div>
    </div>
  );
}
