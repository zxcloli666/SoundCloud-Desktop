import { useTranslation } from 'react-i18next';
import { Loader2 } from '../../lib/icons';

const MB = 1024 * 1024;

function toMb(bytes: number) {
  return (bytes / MB).toFixed(1);
}

export function InstallProgress({
  downloaded,
  total,
  installing,
}: {
  downloaded: number;
  total: number | null;
  installing: boolean;
}) {
  const { t } = useTranslation();
  const ratio = installing ? 1 : total ? Math.min(downloaded / total, 1) : 0;
  const percent = Math.round(ratio * 100);
  const sizeLabel = total
    ? t('update.progressMb', { done: toMb(downloaded), total: toMb(total) })
    : t('update.progressMbUnknown', { done: toMb(downloaded) });

  return (
    <div className="px-5 pb-5" aria-live="polite">
      <div className="rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 size={13} className="shrink-0 animate-spin text-accent" />
            <span className="truncate text-[12.5px] font-medium text-white/80">
              {t(installing ? 'update.installing' : 'update.downloading')}
            </span>
          </div>
          {!installing && (
            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-white/70">
              {total ? `${percent}%` : ''}
            </span>
          )}
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className={`h-full rounded-full bg-accent transition-[width] duration-300 ease-out ${
              !installing && !total ? 'w-1/3 animate-pulse' : ''
            }`}
            style={{
              width: installing || total ? `${percent}%` : undefined,
              boxShadow: '0 0 12px var(--color-accent-glow)',
            }}
          />
        </div>
        {!installing && <p className="mt-2 text-[11px] tabular-nums text-white/35">{sizeLabel}</p>}
      </div>
    </div>
  );
}
