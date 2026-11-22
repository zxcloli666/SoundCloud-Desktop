import { useDisplayTitle } from '../../../lib/track-display';
import type { Track } from '../../../stores/player';

function titleSize(length: number) {
  if (length <= 16) return 'text-[44px] leading-[1.05]';
  if (length <= 28) return 'text-[36px] leading-[1.08]';
  if (length <= 44) return 'text-[28px] leading-[1.12]';
  return 'text-[22px] leading-[1.18]';
}

export function DeckTitle({ track, fallback }: { track: Track; fallback: string }) {
  const title = useDisplayTitle(track).trim() || fallback;
  return (
    <h2
      data-ui="deck-title"
      title={title}
      className={`line-clamp-2 max-w-full text-balance break-words text-center font-bold tracking-[-0.02em] text-ink ${titleSize(title.length)}`}
    >
      {title}
    </h2>
  );
}
