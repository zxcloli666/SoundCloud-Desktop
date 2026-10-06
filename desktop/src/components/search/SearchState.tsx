import { CloudOff, RefreshCw, Sparkles } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePerfMode } from '../../lib/perf';
import { type SearchErrorKind, searchErrorKind } from '../../lib/search';

interface SearchStateProps {
  icon: ReactNode;
  title: string;
  body?: string;
  cta?: string;
  ctaIcon?: ReactNode;
  onAction?: () => void;
}

export const SearchState = memo(function SearchState({
  icon,
  title,
  body,
  cta,
  ctaIcon,
  onAction,
}: SearchStateProps) {
  const b = usePerfMode().blur(40);
  return (
    <div className="flex justify-center px-4 pt-14">
      <div
        className="w-full max-w-[460px] flex flex-col items-center gap-5 p-10 rounded-[2.25rem] text-center"
        style={{
          background:
            b > 0
              ? 'linear-gradient(165deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
              : 'rgba(18,18,22,0.85)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          backdropFilter: b > 0 ? `blur(${b}px) saturate(160%)` : undefined,
          WebkitBackdropFilter: b > 0 ? `blur(${b}px) saturate(160%)` : undefined,
          boxShadow: '0 30px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
          isolation: 'isolate',
        }}
      >
        <div
          className="w-16 h-16 flex items-center justify-center rounded-2xl text-accent"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.08)',
            boxShadow: '0 0 30px var(--color-accent-glow)',
          }}
        >
          {icon}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-lg font-bold text-white/90">{title}</p>
          {body && <p className="text-[13px] leading-relaxed text-white/45">{body}</p>}
        </div>
        {cta && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-[13px] font-semibold cursor-pointer transition-transform duration-500 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              color: 'var(--color-accent-contrast)',
              background: 'linear-gradient(180deg, var(--color-accent), var(--color-accent-hover))',
              boxShadow:
                '0 12px 32px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            {ctaIcon}
            {cta}
          </button>
        )}
      </div>
    </div>
  );
});

const ERROR_TEXT: Record<SearchErrorKind, { title: string; body?: string }> = {
  timeout: { title: 'search.error.timeout' },
  busy: { title: 'search.error.busy' },
  soundcloud: {
    title: 'search.soundcloud.unavailableTitle',
    body: 'search.soundcloud.unavailableBody',
  },
  scBusy: { title: 'search.soundcloud.busyTitle', body: 'search.soundcloud.busyBody' },
  vibe: { title: 'search.vibe.unavailableTitle', body: 'search.vibe.unavailableBody' },
  offline: { title: 'search.error.offline' },
  failed: { title: 'search.error.failed' },
};

export const SearchError = memo(function SearchError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const kind = searchErrorKind(error);
  const text = ERROR_TEXT[kind];
  return (
    <SearchState
      icon={kind === 'vibe' ? <Sparkles size={26} /> : <CloudOff size={26} />}
      title={t(text.title)}
      body={text.body ? t(text.body) : undefined}
      cta={t('search.error.retry')}
      ctaIcon={<RefreshCw size={15} />}
      onAction={onRetry}
    />
  );
});

export const SectionError = memo(function SectionError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-3 text-[12px] text-white/40">
      <span>{t('search.catalog.sectionError')}</span>
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 text-white/70 hover:text-white transition-colors cursor-pointer"
      >
        <RefreshCw size={12} />
        {t('search.error.retry')}
      </button>
    </div>
  );
});

export const StripSkeleton = memo(function StripSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-11 w-32 shrink-0 rounded-full skeleton-shimmer"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        />
      ))}
    </div>
  );
});
