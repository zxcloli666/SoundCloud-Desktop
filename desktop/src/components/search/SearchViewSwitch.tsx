import { GalleryVerticalEnd, LayoutGrid } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type SearchView, useSearchPrefsStore } from '../../stores/searchPrefs';
import { PillTabs } from './PillTabs';

const VIEWS = [
  { view: 'covers', icon: <LayoutGrid size={13} /> },
  { view: 'moments', icon: <GalleryVerticalEnd size={13} /> },
] as const;

export const SearchViewSwitch = memo(function SearchViewSwitch() {
  const { t } = useTranslation();
  const active = useSearchPrefsStore((s) => s.view);
  const setView = useSearchPrefsStore((s) => s.setView);
  const tabs = VIEWS.map(({ view, icon }) => ({
    id: view as SearchView,
    icon,
    label: t(`search.view.${view}`),
    title: `${t(`search.view.${view}`)} (M)`,
  }));
  return <PillTabs ui="search-view" tabs={tabs} active={active} onSelect={setView} />;
});
