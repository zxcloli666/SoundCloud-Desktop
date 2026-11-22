import { useLayoutMenu } from '../../layout/LayoutMenu';
import {
  HiddenPopovers,
  type PlayerContext,
  ToolButtons,
  TrackButtons,
  TransportButtons,
} from '../../layout/player/PlayerButtons';

export function DeckControls({ ctx }: { ctx: PlayerContext }) {
  const menu = useLayoutMenu('player');
  return (
    <div
      data-ui="deck-controls"
      onContextMenu={menu.onContextMenu}
      className="relative flex w-full max-w-[640px] flex-wrap items-center justify-center gap-x-5 gap-y-2"
    >
      <TrackButtons ctx={ctx} />
      <TransportButtons ctx={ctx} />
      <ToolButtons ctx={ctx} />
      <HiddenPopovers ctx={ctx} />
      {menu.menu}
    </div>
  );
}
