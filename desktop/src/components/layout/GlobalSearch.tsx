import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, Search as SearchIcon, X } from '../../lib/icons';
import { isMac } from '../../lib/platform';
import { findSoundCloudLink } from '../../lib/soundcloudLink';
import { useSearchHistoryStore } from '../../stores/searchHistory';
import { useSearchQueryStore } from '../../stores/searchQuery';

export const GlobalSearch = memo(function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const q = useSearchQueryStore((s) => s.q);
  const setQ = useSearchQueryStore((s) => s.setQ);
  const history = useSearchHistoryStore((s) => s.queries);
  const removeQuery = useSearchHistoryStore((s) => s.removeQuery);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);
  const addQuery = useSearchHistoryStore((s) => s.addQuery);

  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUrl = findSoundCloudLink(q) !== null;
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
    <div
      data-ui="search"
      className="relative w-full max-w-[600px]"
      style={{ isolation: 'isolate' }}
    >
      <div
        data-focused={focused || undefined}
        className="relative flex items-center gap-2.5 h-10 pl-3.5 pr-2 rounded-xl border border-[color:var(--shell-line-hi)] bg-[var(--shell-fill)] transition-colors duration-150 hover:bg-[var(--shell-fill-hi)] data-[focused]:border-accent data-[focused]:bg-[var(--shell-fill)]"
      >
        <SearchIcon
          size={17}
          className="shrink-0 transition-colors duration-300"
          style={{ color: focused ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.5)' }}
        />
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
              if (!isUrl && q.trim().length >= 2) addQuery(q.trim());
              goSearch();
              (e.currentTarget as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          placeholder={t('search.globalPlaceholder')}
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-ink-90 placeholder:text-ink-35 select-text"
        />
        {isUrl && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-accent/90 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
            {t('search.urlHint')}
          </span>
        )}
        {q ? (
          <button
            type="button"
            onClick={() => setQ('')}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-ink-40 hover:text-ink-80 hover:bg-ink/5 transition-colors cursor-pointer"
            aria-label={t('search.clear')}
          >
            <X size={15} />
          </button>
        ) : (
          !focused && (
            <kbd className="shrink-0 hidden sm:flex items-center gap-0.5 h-6 px-2 mr-1 rounded-md text-[10px] font-semibold tracking-wide text-ink-30 bg-ink/[0.05] border border-ink/10">
              {isMac() ? '⌘' : 'Ctrl'} K
            </kbd>
          )
        )}
      </div>

      {showHistory && (
        <div className="surface-pop absolute left-0 right-0 mt-2 p-1.5 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-[11px] uppercase tracking-wide text-ink-30">
              {t('search.history')}
            </span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                clearHistory();
              }}
              className="text-[11px] text-ink-35 hover:text-ink-70 transition-colors cursor-pointer"
            >
              {t('search.clearHistory')}
            </button>
          </div>
          {history.slice(0, 8).map((item) => (
            <div
              key={item}
              className="group/h flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-ink/[0.06] transition-colors cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(item);
              }}
            >
              <Clock size={13} className="shrink-0 text-ink-25" />
              <span className="flex-1 min-w-0 truncate text-[13px] text-ink-70">{item}</span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeQuery(item);
                }}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-ink-0 group-hover/h:text-ink-40 hover:!text-ink-80 transition-colors"
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
