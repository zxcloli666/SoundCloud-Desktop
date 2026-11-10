import { useEffect } from 'react';
import type { SettingsResult } from '../../../lib/settings-search/useSettingsSearch';
import { usePerfMode } from '../../../lib/perf';
import { SETTINGS_CATEGORIES } from '../registry';
import { ResultRow } from './ResultRow';
import { SearchEmpty } from './SearchEmpty';

export const RESULTS_ID = 'settings-search-results';
export const rowId = (index: number) => `settings-search-row-${index}`;

export function SearchResults({
  results,
  query,
  active,
  onActive,
  onChoose,
  onClear,
}: {
  results: SettingsResult[];
  query: string;
  active: number;
  onActive: (index: number) => void;
  onChoose: (result: SettingsResult) => void;
  onClear: () => void;
}) {
  const blur = usePerfMode().blur(40);

  useEffect(() => {
    document.getElementById(rowId(active))?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <section
      data-ui="settings-search-results"
      className="animate-fade-in-up relative overflow-hidden rounded-3xl p-2"
      style={{
        border: '0.5px solid rgb(var(--ink) / 0.1)',
        background:
          blur > 0
            ? 'linear-gradient(165deg, rgb(var(--ink) / 0.055), rgb(var(--ink) / 0.015) 58%, rgb(var(--ink) / 0.03))'
            : 'rgb(var(--surface) / 0.85)',
        backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
        WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
        boxShadow:
          '0 18px 50px rgb(var(--shade) / calc(0.4 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-6 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgb(var(--ink) / 0.22), transparent)',
        }}
      />
      {results.length === 0 ? (
        <SearchEmpty onClear={onClear} />
      ) : (
        <div id={RESULTS_ID} role="listbox" className="flex flex-col gap-0.5">
          {results.map((result, index) => (
            <ResultRow
              key={result.id}
              id={rowId(index)}
              result={result}
              icon={SETTINGS_CATEGORIES.find((item) => item.id === result.category)?.icon}
              query={query}
              on={index === active}
              onActive={() => onActive(index)}
              onChoose={() => onChoose(result)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
