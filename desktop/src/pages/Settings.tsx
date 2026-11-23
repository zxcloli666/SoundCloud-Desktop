import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollMainToTop } from '../components/layout/ScrollReset';
import { findPlace, pagesOf, SETTINGS_CATEGORIES } from '../components/settings/registry';
import { CategoryHeader, PageTabs, SearchHeader } from '../components/settings/SettingsHeader';
import { SettingsNav } from '../components/settings/SettingsNav';
import { SearchField } from '../components/settings/search/SearchField';
import { RESULTS_ID, SearchResults } from '../components/settings/search/SearchResults';
import { useSettingsSearchView } from '../components/settings/search/useSettingsSearchView';
import { chatSettingsShown } from '../lib/chat/gate';
import { selectChatEnabled, useChatStore } from '../stores/chat';

export function Settings() {
  const chatShown = useChatStore((state) =>
    chatSettingsShown(selectChatEnabled(state), state.status?.phase ?? null),
  );
  const categories = chatShown
    ? SETTINGS_CATEGORIES
    : SETTINGS_CATEGORIES.filter((c) => c.id !== 'chats');
  const asked = (useLocation().state as { category?: string } | null)?.category;
  const [target, setTarget] = useState(() => asked ?? 'general');
  const lastPage = useRef(new Map<string, string>());

  useEffect(() => {
    if (asked) setTarget(asked);
  }, [asked]);

  const open = (id: string) => {
    const hit = findPlace(categories, id);
    if (hit) lastPage.current.set(hit.category.id, hit.page.id);
    setTarget(id);
    scrollMainToTop();
  };

  const search = useSettingsSearchView(
    categories.flatMap((item) => pagesOf(item).map((p) => p.id)),
    open,
  );

  const { category, page } = findPlace(categories, target) ?? {
    category: categories[0],
    page: pagesOf(categories[0])[0],
  };
  const pages = pagesOf(category);
  const Body = page.Body;

  return (
    <div data-ui="page" data-page="settings" className="min-h-full w-full">
      <div className="mx-auto max-w-[1060px] px-8 pt-7 pb-40">
        <div className="set-layout">
          <SettingsNav
            categories={categories}
            active={search.shown ? null : category.id}
            onChange={(id) => {
              search.clear();
              open(lastPage.current.get(id) ?? id);
            }}
            search={
              <SearchField
                value={search.query}
                onChange={search.edit}
                onFocus={search.reopen}
                onKeyDown={search.onKeyDown}
                onClear={search.clear}
                listId={RESULTS_ID}
                activeId={search.activeId}
              />
            }
          />
          <div className="min-w-0 max-w-[760px]">
            {search.shown ? (
              <>
                <SearchHeader count={search.settingsCount} />
                <SearchResults
                  results={search.results}
                  query={search.query}
                  active={search.active}
                  onActive={search.setCursor}
                  onChoose={search.choose}
                  onClear={search.clear}
                />
              </>
            ) : (
              <>
                <CategoryHeader category={category} />
                {pages.length > 1 && <PageTabs pages={pages} active={page.id} onChange={open} />}
                <div key={page.id} className="flex flex-col gap-4 animate-fade-in-up">
                  <Body />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
