import { formatBytes } from '../../../lib/formatters';
import { Loader2, Trash2 } from '../../../lib/icons';
import { Skeleton } from '../../ui/Skeleton';
import { Info } from '../primitives';

export const CACHE_SHADES = [1, 0.62, 0.38, 0.2];

export function UsageBar({ sizes }: { sizes: Array<number | null> }) {
  const total = sizes.reduce<number>((sum, size) => sum + (size ?? 0), 0);
  return (
    <div className="set-row py-4">
      <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-ink/[0.07]">
        {total > 0 &&
          sizes.map((size, i) =>
            size ? (
              <span
                key={CACHE_SHADES[i]}
                className="h-full bg-accent transition-[flex-grow] duration-500"
                style={{ flexGrow: size / total, opacity: CACHE_SHADES[i] }}
              />
            ) : null,
          )}
      </div>
    </div>
  );
}

export function CacheRow({
  label,
  info,
  size,
  shade,
  clearing,
  onClear,
  clearLabel,
  'data-ui': dataUi,
}: {
  label: string;
  info?: string;
  size: number | null;
  shade: number;
  clearing: boolean;
  onClear: () => void;
  clearLabel: string;
  'data-ui'?: string;
}) {
  return (
    <div data-ui={dataUi} className="set-row flex min-h-[48px] items-center gap-3 py-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" style={{ opacity: shade }} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <p className="truncate text-[13.5px] font-medium text-ink-90">{label}</p>
        {info && <Info text={info} />}
      </span>
      {size === null ? (
        <Skeleton className="h-4 w-14" />
      ) : (
        <span className="text-[13px] text-ink-60 tabular-nums">{formatBytes(size)}</span>
      )}
      <button
        type="button"
        onClick={onClear}
        disabled={clearing || size === 0}
        title={clearLabel}
        aria-label={`${clearLabel}: ${label}`}
        className="set-btn w-8 px-0"
        data-tone="erase"
      >
        {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </button>
    </div>
  );
}
