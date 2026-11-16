import { Cloud, Database, Sparkles } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type SearchMode, useSearchPrefsStore } from '../../stores/searchPrefs';
import { PillTabs } from './PillTabs';
import { SearchViewSwitch } from './SearchViewSwitch';

const MODES = [
  { mode: 'catalog', icon: <Database size={13} /> },
  { mode: 'vibe', icon: <Sparkles size={13} /> },
  { mode: 'soundcloud', icon: <Cloud size={13} /> },
] as const;

export const SearchModeTabs = memo(function SearchModeTabs({
  views,
  compact,
}: {
  views?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const active = useSearchPrefsStore((s) => s.mode);
  const setMode = useSearchPrefsStore((s) => s.setMode);
  const tabs = MODES.map(({ mode, icon }) => ({
    id: mode as SearchMode,
    icon,
    label: t(`search.modes.${mode}`),
    title: t(`search.modes.${mode}Hint`),
  }));
  return (
    <div
      data-ui="search-strip"
      className={`relative z-10 flex flex-wrap items-center justify-center gap-2 px-4 ${compact ? 'mb-1' : 'mb-3'}`}
    >
      <PillTabs ui="search-tabs" tabs={tabs} active={active} onSelect={setMode} />
      {views && <SearchViewSwitch />}
    </div>
  );
});
