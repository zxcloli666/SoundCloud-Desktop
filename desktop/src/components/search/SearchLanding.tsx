import { Clock, Sparkles, X } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchHistoryStore } from '../../stores/searchHistory';
import { useSearchPrefsStore } from '../../stores/searchPrefs';
import { useSearchQueryStore } from '../../stores/searchQuery';
import { GenreTicker } from './GenreTicker';
import { SearchState } from './SearchState';

const HISTORY_SHOWN = 12;

export const SearchLanding = memo(function SearchLanding() {
  const { t } = useTranslation();
  const setQ = useSearchQueryStore((s) => s.setQ);
  const setMode = useSearchPrefsStore((s) => s.setMode);
  const history = useSearchHistoryStore((s) => s.queries);
  const removeQuery = useSearchHistoryStore((s) => s.removeQuery);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  const pickGenre = (genre: string) => {
    setMode('vibe');
    setQ(genre);
  };

  return (
    <>
      <div className="mb-4">
        <GenreTicker onSelect={pickGenre} />
      </div>
      {history.length > 0 ? (
        <section className="max-w-[760px] mx-auto px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wide text-white/35">
              {t('search.history')}
            </span>
            <button
              type="button"
              onClick={clearHistory}
              className="text-[11px] text-white/35 hover:text-white/70 transition-colors cursor-pointer"
            >
              {t('search.clearHistory')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.slice(0, HISTORY_SHOWN).map((item) => (
              <span
                key={item}
                className="group inline-flex items-center gap-1.5 h-8 pl-3 pr-1 rounded-full text-[12.5px] text-white/70 bg-white/[0.04] border border-white/10 hover:bg-white/[0.07] transition-colors"
              >
                <Clock size={12} className="text-white/30" />
                <button
                  type="button"
                  onClick={() => setQ(item)}
                  className="max-w-[220px] truncate cursor-pointer hover:text-white"
                >
                  {item}
                </button>
                <button
                  type="button"
                  onClick={() => removeQuery(item)}
                  aria-label={t('search.clear')}
                  className="w-6 h-6 flex items-center justify-center rounded-full text-white/25 hover:text-white/80 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </section>
      ) : (
        <SearchState
          icon={<Sparkles size={26} />}
          title={t('search.firstTimeTitle')}
          body={t('search.firstTimeBody')}
        />
      )}
    </>
  );
});
