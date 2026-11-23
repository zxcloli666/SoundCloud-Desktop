import { LayoutGrid, List } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type SearchLayout, useSearchPrefsStore } from '../../stores/searchPrefs';

const OPTIONS = [
  { id: 'tiles', icon: LayoutGrid, label: 'search.layout.tiles' },
  { id: 'list', icon: List, label: 'search.layout.list' },
] as const;

export const SearchLayoutToggle = memo(function SearchLayoutToggle() {
  const { t } = useTranslation();
  const layout = useSearchPrefsStore((s) => s.layout);
  const setLayout = useSearchPrefsStore((s) => s.setLayout);
  return (
    <div data-ui="search-layout" role="radiogroup" className="chip-group">
      {OPTIONS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={layout === (id as SearchLayout)}
          aria-label={t(label)}
          title={t(label)}
          onClick={() => setLayout(id)}
          className="chip-seg"
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
});
