import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { getCurrentTime, subscribe } from '../../../lib/audio';
import { isLocalUrn } from '../../../lib/local-library';
import { getLyricsByTrack, type LyricLine } from '../../../lib/lyrics';
import type { Track } from '../../../stores/player';
import { useReducedMotion } from './scene/use-scene-motion';

const FALLBACK_LINE_SEC = 2.6;
const MIN_LINE_SEC = 0.4;

function activeLine(lines: LyricLine[], at: number) {
  let index = -1;
  for (let i = 0; i < lines.length && lines[i].time <= at; i++) index = i;
  return index;
}

export function DeckLyrics({ track }: { track: Track }) {
  const reduced = useReducedMotion();
  const at = useSyncExternalStore(subscribe, getCurrentTime);
  const { data } = useQuery({
    queryKey: ['lyrics', 'track', track.urn],
    queryFn: () => getLyricsByTrack(track.urn),
    enabled: !isLocalUrn(track.urn),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 0,
  });
  const lines = data?.synced?.filter((line) => line.text.trim()) ?? [];
  const index = activeLine(lines, at);

  return (
    <div
      data-ui="deck-lyrics"
      aria-live="polite"
      className="flex h-11 w-full max-w-[560px] flex-col items-center justify-center gap-0.5 text-center"
    >
      {index >= 0 && (
        <ActiveLine line={lines[index]} next={lines[index + 1]} at={at} lit={!reduced} />
      )}
    </div>
  );
}

function ActiveLine({
  line,
  next,
  at,
  lit,
}: {
  line: LyricLine;
  next?: LyricLine;
  at: number;
  lit: boolean;
}) {
  const chars = Array.from(line.text).map((char, id) => ({ char, id }));
  const end = next?.time ?? line.time + FALLBACK_LINE_SEC;
  const progress = Math.max(
    0,
    Math.min(1, (at - line.time) / Math.max(MIN_LINE_SEC, end - line.time)),
  );
  const litCount = lit ? Math.ceil(chars.length * progress) : chars.length;
  return (
    <>
      <p key={line.time} className="line-clamp-1 text-[17px] font-semibold">
        {chars.map(({ char, id }) => (
          <span key={id} className={id < litCount ? 'text-ink' : 'text-ink-30'}>
            {char}
          </span>
        ))}
      </p>
      {next && <p className="line-clamp-1 text-[12.5px] text-ink-35">{next.text}</p>}
    </>
  );
}
