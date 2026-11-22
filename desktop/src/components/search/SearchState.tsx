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
    <div className="flex justify-center px-4 pt-14">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-2xl border border-ink/[0.08] bg-ink/[0.025] p-9 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-ink/[0.08] bg-ink/[0.04] text-accent">
          {icon}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[17px] font-semibold text-ink-90">{title}</p>
          {body && <p className="text-[13px] leading-relaxed text-ink-45">{body}</p>}
        </div>
        {cta && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-accent px-5 text-[13px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
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
        <div
          key={i}
          className="h-11 w-32 shrink-0 rounded-full skeleton-shimmer"
          style={{ background: 'rgb(var(--ink) / 0.04)' }}
        />
      ))}
    </div>
  );
});
