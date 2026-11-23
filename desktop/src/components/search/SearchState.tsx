import { CloudOff, RefreshCw, Sparkles } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink/[0.05] text-ink-40">
        {icon}
      </div>
      <div className="flex max-w-[420px] flex-col gap-1.5">
        <p className="text-[16px] font-semibold text-ink-90">{title}</p>
        {body && <p className="text-[13px] leading-relaxed text-ink-45">{body}</p>}
      </div>
      {cta && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-ink/10 bg-ink/[0.055] px-4 text-[12px] font-semibold text-ink-75 transition-colors hover:border-ink/[0.18] hover:bg-ink/[0.09] hover:text-ink"
        >
          {ctaIcon}
          {cta}
        </button>
      )}
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
    <div className="flex items-center justify-center gap-2 px-4 py-3 text-[12px] text-ink-40">
      <span>{t('search.catalog.sectionError')}</span>
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 text-ink-70 hover:text-ink transition-colors cursor-pointer"
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
        <div key={i} className="h-11 w-32 shrink-0 rounded-full bg-ink/[0.04] skeleton-shimmer" />
      ))}
    </div>
  );
});
