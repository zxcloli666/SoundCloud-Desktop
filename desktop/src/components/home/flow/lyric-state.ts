import { useQuery } from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';
import { getCurrentTime, subscribe } from '../../../lib/audio';
import { isLocalUrn } from '../../../lib/local-library';
import { getLyricsByTrack, type LyricLine } from '../../../lib/lyrics';
import type { Track } from '../../../stores/player';

const FALLBACK_LINE_SEC = 2.6;
const MIN_LINE_SEC = 0.4;
const NO_LINES: LyricLine[] = [];

function activeIndex(lines: LyricLine[], at: number) {
  let index = -1;
  for (let i = 0; i < lines.length && lines[i].time <= at; i++) index = i;
  return index;
}

export function useLyricLine(track: Track): { line?: LyricLine; next?: LyricLine } {
  const { data } = useQuery({
    queryKey: ['lyrics', 'track', track.urn],
    queryFn: () => getLyricsByTrack(track.urn),
    enabled: !isLocalUrn(track.urn),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 0,
  });
  const lines = useMemo(() => data?.synced?.filter((line) => line.text.trim()) ?? NO_LINES, [data]);
  const index = useSyncExternalStore(subscribe, () => activeIndex(lines, getCurrentTime()));
  return index < 0 ? {} : { line: lines[index], next: lines[index + 1] };
}

export function useLitCount(line: LyricLine, next: LyricLine | undefined, length: number) {
  const end = next?.time ?? line.time + FALLBACK_LINE_SEC;
  const span = Math.max(MIN_LINE_SEC, end - line.time);
  return useSyncExternalStore(subscribe, () => {
    const progress = Math.max(0, Math.min(1, (getCurrentTime() - line.time) / span));
    return Math.ceil(length * progress);
  });
}
