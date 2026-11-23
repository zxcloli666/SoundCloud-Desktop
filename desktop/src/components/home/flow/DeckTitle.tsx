import { useDisplayTitle } from '../../../lib/track-display';
import type { Track } from '../../../stores/player';
import type { PlayerContext } from '../../layout/player/PlayerButtons';
import { QueueSlot } from '../../layout/player/PlayerButtons';
import { Marquee } from '../../ui/Marquee';

export function DeckTitle({
  track,
  fallback,
  ctx,
}: {
  track: Track;
  fallback: string;
  ctx: PlayerContext;
}) {
  const title = useDisplayTitle(track).trim() || fallback;
  return (
    <div className="deck-title mt-[clamp(17px,2.7vh,30px)] flex w-full max-w-[690px] items-center justify-center gap-2.5 px-2.5">
      <h2
        data-ui="deck-title"
        className="min-w-0 text-[clamp(20px,1.35vw,26px)] font-medium leading-[1.25] tracking-[-0.03em] text-ink"
      >
        <Marquee label={title}>{title}</Marquee>
      </h2>
      <QueueSlot ctx={ctx} />
    </div>
  );
}
