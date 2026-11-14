import { memo } from 'react';
import { Skeleton } from '../ui/Skeleton';
import type { WaitShape } from './scope';

const ROWS = [
  { title: 'w-[46%]', artist: 'w-[24%]', fade: 1 },
  { title: 'w-[34%]', artist: 'w-[30%]', fade: 0.78 },
  { title: 'w-[52%]', artist: 'w-[20%]', fade: 0.56 },
  { title: 'w-[40%]', artist: 'w-[28%]', fade: 0.36 },
  { title: 'w-[30%]', artist: 'w-[18%]', fade: 0.2 },
];

const TILES = [1, 0.8, 0.62, 0.46, 0.34, 0.24, 0.16, 0.1];

export const WaitSkeleton = memo(function WaitSkeleton({ shape }: { shape: WaitShape }) {
  if (shape === 'rows') {
    return (
      <div className="flex w-full flex-col gap-1">
        {ROWS.map((row, i) => (
          <div
            key={i}
            className="flex h-[60px] items-center gap-3.5 px-3"
            style={{ opacity: row.fade }}
          >
            <Skeleton className="size-11 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className={`h-3 ${row.title}`} rounded="full" />
              <Skeleton className={`h-2.5 ${row.artist}`} rounded="full" />
            </div>
            <Skeleton className="h-2.5 w-9 shrink-0" rounded="full" />
          </div>
        ))}
      </div>
    );
  }

  const covers = shape === 'covers';
  return (
    <div
      className={`grid w-full auto-rows-[0px] grid-rows-[auto] overflow-hidden ${
        covers
          ? 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-6'
          : 'grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-4'
      }`}
    >
      {TILES.map((fade, i) => (
        <div key={i} style={{ opacity: fade }}>
          {covers ? (
            <Skeleton className="aspect-square w-full" rounded="lg" />
          ) : (
            <Skeleton className="mx-auto size-24" rounded="full" />
          )}
          <Skeleton className={`mt-3 h-3 ${covers ? 'w-3/4' : 'mx-auto w-2/3'}`} rounded="full" />
          <Skeleton className={`mt-2 h-2.5 ${covers ? 'w-1/2' : 'mx-auto w-1/3'}`} rounded="full" />
        </div>
      ))}
    </div>
  );
});
