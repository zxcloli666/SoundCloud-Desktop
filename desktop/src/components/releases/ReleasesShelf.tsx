import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight, Sparkles } from '../../lib/icons';
import { RELEASE_DAYS } from '../../lib/new-releases';
import { useReleaseFeed } from '../../lib/new-releases-api';
import { usePremium } from '../../lib/premium-cache';
import { HorizontalScroll } from '../ui/HorizontalScroll';
import { Skeleton } from '../ui/Skeleton';
import { SyncNotice } from '../ui/SyncNotice';
import { ReleaseActions } from './ReleaseActions';
import { ReleaseCard } from './ReleaseCard';
import { ReleasesLocked } from './ReleasesLocked';

const SHELF_CAP = 20;

function CardSkeletons() {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="w-[188px] shrink-0">
          <Skeleton className="aspect-square w-full" rounded="lg" />
          <div className="mt-2.5 flex items-center gap-2.5">
            <Skeleton className="size-7" rounded="full" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-3/4" rounded="sm" />
              <Skeleton className="mt-1.5 h-3 w-1/2" rounded="sm" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export const ReleasesShelf = memo(function ReleasesShelf() {
  const { t } = useTranslation();
  const premium = usePremium();
  const { tracks, heard, unheard, query } = useReleaseFeed();

  if (!premium) return <ReleasesLocked />;
  if (!query.isLoading && !query.isError && tracks.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 pl-1">
        <span className="flex size-8 items-center justify-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/25">
          <Sparkles size={15} />
        </span>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[20px] font-bold leading-tight tracking-[-0.015em] text-ink-92">
            {t('releases.title')}
            {unheard > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-black tabular-nums text-accent-contrast">
                {unheard}
              </span>
            )}
          </h2>
          <p className="text-[12px] text-ink-45">{t('releases.why', { count: RELEASE_DAYS })}</p>
        </div>
        <span className="flex-1" />
        <ReleaseActions tracks={tracks} />
        <Link
          to="/library/releases"
          className="flex items-center gap-0.5 text-[12px] font-semibold text-ink-45 transition-colors hover:text-ink-90"
        >
          {t('library.seeAll')}
          <ChevronRight size={14} />
        </Link>
      </div>
      {query.isError && tracks.length === 0 ? (
        <SyncNotice kind="failed" onRetry={() => void query.refetch()} />
      ) : (
        <HorizontalScroll>
          {query.isLoading ? (
            <CardSkeletons />
          ) : (
            tracks.slice(0, SHELF_CAP).map((track) => (
              <div key={track.urn} className="w-[188px] shrink-0">
                <ReleaseCard track={track} queue={tracks} heard={heard.has(track.urn)} />
              </div>
            ))
          )}
        </HorizontalScroll>
      )}
    </section>
  );
});
