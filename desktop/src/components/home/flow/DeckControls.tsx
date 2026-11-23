import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import { useLayout } from '../../../lib/use-layout';
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
const LEFT = 'deck-track col-start-1 flex items-center gap-2.5 justify-self-end';
const RIGHT = 'deck-tools col-start-3 flex items-center gap-2.5 justify-self-start';
const TRAY_GROUP = 'flex flex-wrap items-center justify-center gap-2.5';

const SEEK_MIN = 260;
const GAP = 10;
const FLANK_SIZES = [46, 40];
const FLANK_MAX_ITEMS = 4;
const TRAY_SIZE = 40;
const WIDE_ITEM = '[data-ui="player-quality"]';

interface Fit {
  tray: boolean;
  size: number;
}

interface GroupSize {
  items: number;
  units: number;
}

function groupSize(group: Element | null): GroupSize {
  let items = 0;
  let units = 0;
  for (const child of group?.children ?? []) {
    if (child.matches(WIDE_ITEM)) {
      items += 1;
      units += 2;
    } else if (getComputedStyle(child).display !== 'none') {
      items += 1;
      units += 1;
    }
  }
  return { items, units };
}

function span(group: GroupSize, size: number) {
  return group.units * size + Math.max(0, group.items - 1) * GAP;
}

function fitFor(width: number, track: GroupSize, tools: GroupSize): Fit {
  if (Math.max(track.items, tools.items) > FLANK_MAX_ITEMS) return { tray: true, size: TRAY_SIZE };
  for (const size of FLANK_SIZES) {
    const side = Math.max(span(track, size), span(tools, size));
    if (2 * side + SEEK_MIN + 2 * GAP <= width) return { tray: false, size };
  }
  return { tray: true, size: TRAY_SIZE };
}

function useDeckFit() {
  const ref = useRef<HTMLDivElement>(null);
  const layout = useLayout('player');
  const [width, setWidth] = useState(0);
  const [fit, setFit] = useState<Fit>({ tray: false, size: FLANK_SIZES[0] });

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => setWidth(Math.round(root.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || width === 0 || layout.length === 0) return;
    const next = fitFor(
      width,
      groupSize(root.querySelector('.deck-track')),
      groupSize(root.querySelector('.deck-tools')),
    );
    setFit((prev) => (prev.tray === next.tray && prev.size === next.size ? prev : next));
  }, [width, layout]);

  return { ref, fit };
}

export function DeckControls({ ctx }: { ctx: PlayerContext }) {
  const menu = useLayoutMenu('player');
  const { ref, fit } = useDeckFit();
  const style = { '--deck-btn': `${fit.size}px` } as CSSProperties;

  return (
    <div
      ref={ref}
      data-ui="deck-controls"
      data-fit={fit.tray ? 'tray' : 'flank'}
      onContextMenu={menu.onContextMenu}
      style={style}
      className="deck-round relative mt-[clamp(12px,1.8vh,18px)] flex w-full max-w-[1080px] flex-col items-center gap-[clamp(14px,2vh,20px)]"
    >
      {fit.tray ? (
        <div className="w-full max-w-[520px]">
          <DeckSeek />
        </div>
      ) : (
        <div
          className="grid w-full items-center gap-2.5"
          style={{ gridTemplateColumns: `1fr minmax(${SEEK_MIN}px, 520px) 1fr` }}
        >
          <TrackButtons ctx={ctx} className={LEFT} />
          <DeckSeek />
          <ToolButtons ctx={ctx} omit={TITLE_IDS} className={RIGHT} />
        </div>
      )}
      <TransportButtons ctx={ctx} />
      {fit.tray && (
        <div
          data-ui="deck-tray"
          className="flex w-full flex-wrap items-center justify-center gap-x-7 gap-y-3"
        >
          <TrackButtons ctx={ctx} className={`deck-track ${TRAY_GROUP}`} />
          <ToolButtons ctx={ctx} omit={TITLE_IDS} className={`deck-tools ${TRAY_GROUP}`} />
        </div>
      )}
      <HiddenPopovers ctx={ctx} />
      {menu.menu}
    </div>
  );
}
