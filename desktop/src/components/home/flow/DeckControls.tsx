import { useLayoutMenu } from '../../layout/LayoutMenu';
import {
  HiddenPopovers,
  type PlayerButtonId,
  type PlayerContext,
  ToolButtons,
  TrackButtons,
  TransportButtons,
} from '../../layout/player/PlayerButtons';
import { DeckSeek } from './DeckSeek';

const TITLE_IDS: readonly PlayerButtonId[] = ['queue'];
const LEFT = 'col-start-1 flex items-center gap-2.5 justify-self-end';
const RIGHT = 'col-start-3 flex items-center gap-2.5 justify-self-start';

export function DeckControls({ ctx }: { ctx: PlayerContext }) {
  const menu = useLayoutMenu('player');
  return (
    <div
      data-ui="deck-controls"
      onContextMenu={menu.onContextMenu}
      className="deck-round relative mt-[clamp(12px,1.8vh,18px)] flex w-full max-w-[1080px] flex-col items-center gap-[clamp(14px,2vh,20px)]"
    >
      <div className="grid w-full grid-cols-[1fr_minmax(0,520px)_1fr] items-center gap-2.5">
        <TrackButtons ctx={ctx} className={LEFT} />
        <DeckSeek />
        <ToolButtons ctx={ctx} omit={TITLE_IDS} className={RIGHT} />
      </div>
      <TransportButtons ctx={ctx} />
      <HiddenPopovers ctx={ctx} />
      {menu.menu}
    </div>
  );
}
