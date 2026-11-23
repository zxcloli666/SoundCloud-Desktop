import type { LyricLine } from '../../../lib/lyrics';
import { useReducedMotion } from '../../../lib/reduced-motion';
import type { Track } from '../../../stores/player';
import { useLitCount, useLyricLine } from './lyric-state';

const LIT = 'text-ink [text-shadow:0_0_9px_rgb(var(--ink)/0.28)]';
const DIM = 'text-ink-35';
const BIG =
  'line-clamp-3 text-[clamp(19px,1.7vw,29px)] font-bold leading-[1.18] tracking-[-0.04em] break-words';

function LitText({
  line,
  next,
  className,
}: {
  line: LyricLine;
  next?: LyricLine;
  className: string;
}) {
  const reduced = useReducedMotion();
  const chars = Array.from(line.text).map((char, id) => ({ char, id }));
  const count = useLitCount(line, next, chars.length);
  const lit = reduced ? chars.length : count;
  return (
    <p className={`deck-lyric-in ${className}`}>
      {chars.map(({ char, id }) => (
        <span key={id} className={id < lit ? LIT : DIM}>
          {char}
        </span>
      ))}
    </p>
  );
}

export function LyricCurrent({ track }: { track: Track }) {
  const { line, next } = useLyricLine(track);
  return (
    <div data-ui="deck-lyric-current" aria-live="polite" className="mt-2 min-h-[3.6em]">
      {line && <LitText key={line.time} line={line} next={next} className={BIG} />}
    </div>
  );
}

export function LyricNext({ track }: { track: Track }) {
  const { next } = useLyricLine(track);
  return (
    <div
      data-ui="deck-lyric-next"
      className="mt-3 hidden min-h-[3.6em] border-t border-ink/[0.08] pt-6 @min-[1180px]:block"
    >
      {next && (
        <p
          key={next.time}
          className="deck-lyric-in line-clamp-3 text-[clamp(17px,1.45vw,24px)] font-bold leading-[1.2] tracking-[-0.03em] break-words text-ink-70"
        >
          {next.text}
        </p>
      )}
    </div>
  );
}

export function LyricInline({ track }: { track: Track }) {
  const { line, next } = useLyricLine(track);
  return (
    <div
      data-ui="deck-lyrics"
      aria-live="polite"
      className="mt-5 flex h-12 w-full max-w-[560px] flex-col items-center justify-center gap-0.5 text-center @min-[1180px]:hidden"
    >
      {line && (
        <LitText
          key={line.time}
          line={line}
          next={next}
          className="line-clamp-1 text-[17px] font-semibold"
        />
      )}
      {next && <p className="line-clamp-1 text-[12.5px] text-ink-40">{next.text}</p>}
    </div>
  );
}
