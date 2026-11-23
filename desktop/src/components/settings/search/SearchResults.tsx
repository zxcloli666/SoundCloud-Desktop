import { useEffect } from 'react';
import type { SettingsResult } from '../../../lib/settings-search/useSettingsSearch';
import { pageIcon } from '../registry';
import { POINTER_ICONS } from './pointers';
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
  useEffect(() => {
    document.getElementById(rowId(active))?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <section data-ui="settings-search-results" className="set-panel animate-fade-in-up p-1.5">
      {results.length === 0 ? (
        <SearchEmpty onClear={onClear} />
      ) : (
        <div id={RESULTS_ID} role="listbox" className="flex flex-col gap-0.5">
          {results.map((result, index) => (
            <ResultRow
              key={result.id}
              id={rowId(index)}
              result={result}
              icon={
                result.kind === 'pointer' ? POINTER_ICONS[result.id] : pageIcon(result.category)
              }
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
