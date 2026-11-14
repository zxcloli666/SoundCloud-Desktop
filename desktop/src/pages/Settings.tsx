import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'react-router-dom';
import {Search} from '../lib/icons';
import {scrollMainToTop} from '../components/layout/ScrollReset';
import {SETTINGS_CATEGORIES, type SettingsCategoryId} from '../components/settings/registry';
import {SettingsFrame} from '../components/settings/SettingsFrame';
import {SearchField} from '../components/settings/search/SearchField';
import {RESULTS_ID, SearchResults} from '../components/settings/search/SearchResults';
import {useSettingsSearchView} from '../components/settings/search/useSettingsSearchView';
import {SettingsNav} from '../components/settings/SettingsNav';
import {chatSettingsShown} from '../lib/chat/gate';
import {useViewerAura} from '../lib/useViewerAura';
import {selectChatEnabled, useChatStore} from '../stores/chat';

function askedCategory(state: { category?: SettingsCategoryId } | null): SettingsCategoryId | undefined {
    const id = state?.category;
    return SETTINGS_CATEGORIES.some((c) => c.id === id) ? id : undefined;
}

/** Settings — a star-lit two-pane workspace: a frosted category rail on the
 *  left, the active category's cards on the right. Thin shell; each section is
 *  its own small card under components/settings/. */
export function Settings() {
  const { t } = useTranslation();
    const aura = useViewerAura();
    const chatShown = useChatStore((state) =>
        chatSettingsShown(selectChatEnabled(state), state.status?.phase ?? null),
    );
    const categories = chatShown
        ? SETTINGS_CATEGORIES
        : SETTINGS_CATEGORIES.filter((c) => c.id !== 'chats');
    const asked = useLocation().state as { category?: SettingsCategoryId } | null;
    const [active, setActive] = useState<SettingsCategoryId>(() => askedCategory(asked) ?? 'general');
    useEffect(() => {
        const category = askedCategory(asked);
        if (category) setActive(category);
    }, [asked]);
    const selectCategory = (id: SettingsCategoryId) => {
        setActive(id);
        scrollMainToTop();
    };
    const category = categories.find((c) => c.id === active) ?? categories[0];
    const Body = category.Body;
    const search = useSettingsSearchView(
        categories.map((c) => c.id),
        (id) => selectCategory(id as SettingsCategoryId),
    );

  return (
      <SettingsFrame aura={aura}>
          <div data-ui="page" data-page="settings" className="max-w-[1080px] mx-auto px-6 md:px-8 pt-8 pb-32 flex gap-8">
              <SettingsNav
                  categories={categories}
                  active={search.shown ? null : category.id}
                  onChange={(id) => {
                      search.clear();
                      selectCategory(id);
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
              <div className="flex-1 min-w-0">
                  <header className="mb-7 flex items-center gap-4">
                      <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-[var(--color-accent)]"
                          style={{
                              background:
                                  'linear-gradient(135deg, var(--color-accent-glow), rgb(var(--ink) / 0.05))',
                              border: '0.5px solid var(--color-accent-glow)',
                              boxShadow:
                                  '0 0 26px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.18)',
                          }}
                      >
                          {search.shown ? <Search size={17}/> : category.icon}
                      </div>
                      <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-ink-35 font-bold mb-1">
                              {t('settings.title')}
                          </p>
                          <h1
                              className="text-[30px] font-black tracking-tight leading-none"
                              style={{
                                  backgroundImage: aura.nameGradient,
                                  WebkitBackgroundClip: 'text',
                                  backgroundClip: 'text',
                                  color: 'transparent',
                              }}
                          >
                              {search.shown ? t('settings.search') : t(category.labelKey)}
                          </h1>
            </div>
                      {search.shown && (
                          <span
                              data-ui="settings-search-count"
                              className="self-end mb-0.5 h-7 min-w-7 px-2.5 rounded-full inline-flex items-center justify-center text-[12px] font-bold tabular-nums text-[var(--color-accent)]"
                              style={{
                                  background: 'var(--color-accent-glow)',
                                  border: '0.5px solid var(--color-accent-glow)',
                              }}
                          >
                              {search.settingsCount}
                          </span>
                      )}
                  </header>
                  {search.shown ? (
                      <SearchResults
                          results={search.results}
                          query={search.query}
                          active={search.active}
                          onActive={search.setCursor}
                          onChoose={search.choose}
                          onClear={search.clear}
                      />
                  ) : (
                      <div key={category.id} className="space-y-5 animate-fade-in-up">
                          <Body/>
                      </div>
                  )}
              </div>
          </div>
      </SettingsFrame>
  );
}
