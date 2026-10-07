import { Cloud, Database, Sparkles } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type SearchMode, useSearchPrefsStore } from '../../stores/searchPrefs';

const MODES: { mode: SearchMode; icon: ReactNode }[] = [
  { mode: 'catalog', icon: <Database size={13} /> },
  { mode: 'vibe', icon: <Sparkles size={13} /> },
  { mode: 'soundcloud', icon: <Cloud size={13} /> },
];

export const SearchModeTabs = memo(function SearchModeTabs() {
  const { t } = useTranslation();
  const active = useSearchPrefsStore((s) => s.mode);
  const setMode = useSearchPrefsStore((s) => s.setMode);
  return (
    <div className="flex justify-center px-4 mb-3">
      <div
        role="tablist"
        className="flex items-center gap-0.5 p-0.5 rounded-full bg-white/[0.04] border border-white/10"
      >
        {MODES.map(({ mode, icon }) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active === mode}
            onClick={() => setMode(mode)}
            title={t(`search.modes.${mode}Hint`)}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12px] font-medium transition-all duration-300 cursor-pointer"
            style={
              active === mode
                ? {
                    color: '#fff',
                    background:
                      'linear-gradient(180deg, var(--color-accent-glow), transparent), rgba(255,255,255,0.04)',
                    boxShadow:
                      '0 0 16px var(--color-accent-glow), inset 0 0.5px 0 rgba(255,255,255,0.12)',
                  }
                : { color: 'rgba(255,255,255,0.45)' }
            }
          >
            {icon}
            {t(`search.modes.${mode}`)}
          </button>
        ))}
      </div>
    </div>
  );
});
