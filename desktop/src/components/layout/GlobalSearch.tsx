import {memo, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate} from 'react-router-dom';
import {Clock, Search as SearchIcon, X} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import {isMac} from '../../lib/platform';
import {findSoundCloudLink} from '../../lib/soundcloudLink';
import {useSearchHistoryStore} from '../../stores/searchHistory';
import {useSearchQueryStore} from '../../stores/searchQuery';

/* The one global search field — lives in the titlebar, present on every page.
 * Writes the shared query store and routes to /search; the Search page reads
 * that store, so there's a single search input app-wide. Glass lens, accent glow
 * on focus, ⌘K hint, recent-search dropdown. */
export const GlobalSearch = memo(function GlobalSearch() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const q = useSearchQueryStore((s) => s.q);
    const setQ = useSearchQueryStore((s) => s.setQ);
    const history = useSearchHistoryStore((s) => s.queries);
    const removeQuery = useSearchHistoryStore((s) => s.removeQuery);
    const clearHistory = useSearchHistoryStore((s) => s.clearHistory);
    const addQuery = useSearchHistoryStore((s) => s.addQuery);

    const perf = usePerfMode();
    const fieldBlur = perf.blur(24);
    const dropBlur = perf.blur(32);

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
        <div data-ui="search" className="relative w-full max-w-[600px]" style={{isolation: 'isolate'}}>
            <div
                className="relative flex items-center gap-2.5 h-11 pl-4 pr-2 rounded-full overflow-hidden"
                style={{
                    background:
                        fieldBlur > 0
                            ? 'linear-gradient(165deg, rgb(var(--ink) / 0.07) 0%, rgb(var(--ink) / 0.025) 60%, rgb(var(--ink) / 0.045) 100%)'
                            : 'rgb(var(--surface-hi) / 0.9)',
                    border: `0.5px solid ${focused ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.12)'}`,
                    backdropFilter: fieldBlur > 0 ? `blur(${fieldBlur}px) saturate(160%)` : undefined,
                    WebkitBackdropFilter: fieldBlur > 0 ? `blur(${fieldBlur}px) saturate(160%)` : undefined,
                    boxShadow: focused
                        ? '0 10px 34px rgb(var(--shade) / calc(0.4 * var(--shade-alpha))), 0 0 22px var(--color-accent-glow), inset 0 1px 0 rgb(var(--ink) / 0.1)'
                        : '0 6px 20px rgb(var(--shade) / calc(0.28 * var(--shade-alpha))), inset 0 1px 0 rgb(var(--ink) / 0.07)',
                    transition: 'border-color 300ms ease, box-shadow 400ms ease',
                }}
            >
                {/* specular sheen */}
                <div
                    className="absolute inset-x-6 top-0 h-px pointer-events-none"
                    style={{
                        background: 'linear-gradient(90deg, transparent, rgb(var(--ink) / 0.4), transparent)',
                    }}
                />
                <SearchIcon
                    size={17}
                    className="shrink-0 transition-colors duration-300"
                    style={{color: focused ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.45)'}}
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
                    <span
                        className="shrink-0 text-[10px] uppercase tracking-wide text-accent/90 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
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
                        <X size={15}/>
                    </button>
                ) : (
                    !focused && (
                        <kbd
                            className="shrink-0 hidden sm:flex items-center gap-0.5 h-6 px-2 mr-1 rounded-md text-[10px] font-semibold tracking-wide text-ink-30 bg-ink/[0.05] border border-ink/10">
                            {isMac() ? '⌘' : 'Ctrl'} K
                        </kbd>
                    )
                )}
            </div>

            {showHistory && (
                <div
                    className="absolute left-0 right-0 mt-2 p-1.5 rounded-2xl overflow-hidden"
                    style={{
                        background: dropBlur > 0 ? 'rgb(var(--surface) / 0.78)' : 'rgb(var(--surface) / 0.96)',
                        border: '0.5px solid rgb(var(--ink) / 0.1)',
                        backdropFilter: dropBlur > 0 ? `blur(${dropBlur}px) saturate(150%)` : undefined,
                        WebkitBackdropFilter: dropBlur > 0 ? `blur(${dropBlur}px) saturate(150%)` : undefined,
                        boxShadow: '0 24px 60px rgb(var(--shade) / calc(0.55 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                >
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
                            <Clock size={13} className="shrink-0 text-ink-25"/>
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
                                <X size={13}/>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
