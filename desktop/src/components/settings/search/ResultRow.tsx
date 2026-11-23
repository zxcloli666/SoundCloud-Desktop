import { memo, type ReactNode } from 'react';
import { ChevronRight, ExternalLink } from '../../../lib/icons';
import type { SettingsResult } from '../../../lib/settings-search/useSettingsSearch';
import { Highlighted } from './Highlighted';

export const ResultRow = memo(function ResultRow({
  id,
  result,
  icon,
  query,
  on,
  onActive,
  onChoose,
}: {
  id: string;
  result: SettingsResult;
  icon: ReactNode;
  query: string;
  on: boolean;
  onActive: () => void;
  onChoose: () => void;
}) {
  const section = result.kind === 'section';
  const pointer = result.kind === 'pointer';
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={on}
      data-ui="settings-search-result"
      data-kind={result.kind}
      data-active={on ? 'true' : undefined}
      onMouseMove={on ? undefined : onActive}
      onClick={onChoose}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors duration-150 ${
        on ? 'border-[color:var(--set-line)] bg-[var(--set-well-hi)]' : 'border-transparent'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] [&>svg]:h-[17px] [&>svg]:w-[17px] ${
          section
            ? 'bg-accent text-accent-contrast'
            : 'bg-[var(--set-well)] text-[var(--color-accent)]'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[13.5px] text-ink-90 ${section ? 'font-semibold' : 'font-medium'}`}
        >
          <Highlighted text={result.title} query={query} />
        </span>
        {!section && (
          <span className="mt-0.5 block truncate text-[11.5px] text-ink-40">{result.path}</span>
        )}
        {result.desc !== '' && (
          <span className="mt-0.5 line-clamp-1 text-[12px] text-ink-50">
            {result.descMatched ? <Highlighted text={result.desc} query={query} /> : result.desc}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={`flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1 text-[12px] ${
          on ? 'bg-ink/[0.08] text-ink-60' : 'text-ink-35'
        } ${on || section || pointer ? 'opacity-100' : 'opacity-0'}`}
      >
        {pointer && <ExternalLink size={13} />}
        {!pointer && (section && !on ? <ChevronRight size={16} /> : '↵')}
      </span>
    </button>
  );
});
