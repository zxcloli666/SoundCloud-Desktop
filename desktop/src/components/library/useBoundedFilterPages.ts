import {useEffect, useRef, useState} from 'react';

interface PageFetchResult {
  hasNextPage?: boolean;
}

interface FilterScan {
  key: string;
  requested: number;
  inFlight: boolean;
  hasMore?: boolean;
}

/**
 * Search a small, bounded window beyond the pages already in memory. The scan
 * stops as soon as a match appears, the collection ends, or the request budget
 * is spent. A new normalized filter starts a fresh generation; late completions
 * from an older generation cannot continue its loop.
 */
export function useBoundedFilterPages(
  filter: string,
  matchCount: number,
  hasNextPage: boolean | undefined,
  isLoading: boolean,
  isFetchingNextPage: boolean,
  fetchNextPage: () => Promise<PageFetchResult>,
  maxPages = 2,
): boolean {
  const key = filter.trim().toLocaleLowerCase();
  const scanRef = useRef<FilterScan>({key: '', requested: 0, inFlight: false});
  const [revision, setRevision] = useState(0);
  const [scanning, setScanning] = useState(false);

  if (scanRef.current.key !== key) {
    scanRef.current = {key, requested: 0, inFlight: false};
  }

  useEffect(() => {
    // `revision` is the completion signal for an imperative page fetch. Reading
    // it here makes the next bounded scan step explicit to the hook scheduler.
    void revision;
    const scan = scanRef.current;
    if (!key || scan.key !== key || matchCount > 0) {
      setScanning(false);
      return;
    }
    if (isLoading || isFetchingNextPage || scan.inFlight) {
      setScanning(true);
      return;
    }

    const hasMore = scan.hasMore ?? hasNextPage === true;
    if (!hasMore || scan.requested >= maxPages) {
      setScanning(false);
      return;
    }

    scan.inFlight = true;
    scan.requested += 1;
    setScanning(true);
    void fetchNextPage()
      .then((result) => {
        if (scanRef.current === scan) scan.hasMore = result.hasNextPage === true;
      })
      .catch(() => {
        if (scanRef.current === scan) scan.hasMore = false;
      })
      .finally(() => {
        if (scanRef.current !== scan) return;
        scan.inFlight = false;
        setRevision((value) => value + 1);
      });
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    key,
    matchCount,
    maxPages,
    revision,
  ]);

  const scan = scanRef.current;
  const canRequestMore =
    scan.key === key && scan.requested < maxPages && (scan.hasMore ?? hasNextPage === true);
  return Boolean(
    key &&
      matchCount === 0 &&
      (scanning || isLoading || isFetchingNextPage || scan.inFlight || canRequestMore),
  );
}
