import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, Search as SearchIcon, X } from '../../lib/icons';
import { isMac } from '../../lib/platform';
import { useSearchHistoryStore } from '../../stores/searchHistory';
import { useSearchQueryStore } from '../../stores/searchQuery';
import { isSoundCloudUrl } from '../search/utils';

/* The one global search field — lives in the titlebar, present on every page.
 * Writes the shared query store and routes to /search; the Search page reads
 * that store, so there's a single search input app-wide. Glass lens, accent glow
 * on focus, ⌘K hint, recent-search dropdown. */
export const GlobalSearch = memo(function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const q = useSearchQueryStore((s) => s.q);
  const setQ = useSearchQueryStore((s) => s.setQ);
  const history = useSearchHistoryStore((s) => s.queries);
  const removeQuery = useSearchHistoryStore((s) => s.removeQuery);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUrl = isSoundCloudUrl(q);
  const showHistory = focused && q.trim() === '' && history.length > 0;

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const goSearch = () => {
    if (location.pathname !== '/search') navigate('/search');
  };
  const change = (v: string) => {
    setQ(v);
    if (v) goSearch();
  };
  const pick = (value: string) => {
    setQ(value);
    goSearch();
  };

  return (
    <div className="relative w-full max-w-[620px]" style={{ isolation: 'isolate' }}>
      <div className="relative flex h-9 items-center gap-2.5 overflow-hidden rounded-full border border-white/[0.10] bg-[#18181b] pl-3 pr-2 transition-colors duration-150 focus-within:border-white/[0.18] focus-within:bg-[#1d1d20]">
        <SearchIcon size={15} className="shrink-0 text-white/38 transition-colors duration-150" />
        <input
          id="global-search-input"
          value={q}
          onChange={(e) => change(e.target.value)}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setFocused(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              goSearch();
              (e.currentTarget as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          placeholder={t('search.globalPlaceholder')}
          spellCheck={false}
          className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-[12px] text-white/86 outline-none focus:outline-none focus-visible:outline-none placeholder:text-white/30 select-text"
        />
        {isUrl && (
          <span className="shrink-0 border border-accent/20 bg-accent/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-accent/90">
            {t('search.urlHint')}
          </span>
        )}
        {q ? (
          <button
            type="button"
            onClick={() => setQ('')}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center text-white/32 transition-colors hover:bg-white/[0.035] hover:text-white/72"
            aria-label={t('search.clear')}
          >
            <X size={15} />
          </button>
        ) : (
          !focused && (
            <kbd className="mr-1 hidden h-5 shrink-0 items-center gap-0.5 border border-white/[0.08] px-1.5 text-[9px] font-semibold tracking-wide text-white/24 sm:flex">
              {isMac() ? '⌘' : 'Ctrl'} K
            </kbd>
          )
        )}
      </div>

      {showHistory && (
        <div
          className="absolute left-0 right-0 mt-2 overflow-hidden rounded-xl bg-[#171719] p-1.5"
          style={{
            boxShadow: '0 18px 40px rgba(0,0,0,0.48)',
          }}
        >
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-[11px] uppercase tracking-wide text-white/30">
              {t('search.history')}
            </span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                clearHistory();
              }}
              className="text-[11px] text-white/35 hover:text-white/70 transition-colors cursor-pointer"
            >
              {t('search.clearHistory')}
            </button>
          </div>
          {history.slice(0, 8).map((item) => (
            <div
              key={item}
              className="group/h flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(item);
              }}
            >
              <Clock size={13} className="shrink-0 text-white/25" />
              <span className="flex-1 min-w-0 truncate text-[13px] text-white/70">{item}</span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeQuery(item);
                }}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-white/0 group-hover/h:text-white/40 hover:!text-white/80 transition-colors"
                aria-label={t('search.clear')}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
