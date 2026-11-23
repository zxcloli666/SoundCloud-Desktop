import type { MouseEventHandler } from 'react';
import { useDisplayTitle } from '../../../lib/track-display';
import type { Track } from '../../../stores/player';
import { type PlayerContext, Zone } from '../../layout/player/PlayerButtons';
import { Marquee } from '../../ui/Marquee';

export function DeckTitle({
  track,
  fallback,
  ctx,
  onContextMenu,
}: {
  track: Track;
  fallback: string;
  ctx: PlayerContext;
  onContextMenu: MouseEventHandler;
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
      <Zone
        zone="title"
        ctx={ctx}
        onContextMenu={onContextMenu}
        className="flex shrink-0 items-center gap-1.5"
      />
    </div>
  );
}
