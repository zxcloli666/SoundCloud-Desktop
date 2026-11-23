import { Skeleton } from '../../../ui/Skeleton';
import { SyncNotice } from '../../../ui/SyncNotice';

export interface Feed {
  loading: boolean;
  failed: boolean;
  empty: boolean;
  retry: () => void;
  more: () => void;
}

export function feedOf(
  query: {
    isLoading: boolean;
    isError: boolean;
    refetch: () => unknown;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    fetchNextPage?: () => unknown;
  },
  count: number,
): Feed {
  return {
    loading: query.isLoading,
    failed: query.isError && count === 0,
    empty: !query.isLoading && !query.isError && count === 0,
    retry: () => void query.refetch(),
    more: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage?.();
    },
  };
}

export function ShelfPlaceholder({ feed, hint }: { feed: Feed; hint: string }) {
  if (feed.failed) return <SyncNotice kind="failed" onRetry={feed.retry} />;
  if (feed.empty) return <p className="px-1 py-6 text-[12.5px] text-ink-40">{hint}</p>;
  return (
    <div className="flex gap-4 overflow-hidden px-0.5" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={`sk-${i}`} className="w-[92px] shrink-0">
          <Skeleton className="aspect-square w-full" rounded="lg" />
          <Skeleton className="mt-2.5 h-3.5 w-3/4" rounded="sm" />
        </div>
      ))}
    </div>
  );
}
