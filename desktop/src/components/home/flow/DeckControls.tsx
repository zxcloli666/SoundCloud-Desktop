import {
  type CSSProperties,
  type MouseEventHandler,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { usePlacement } from '../../../lib/use-layout';
import {
  HiddenPopovers,
  type PlayerContext,
  TransportButtons,
  Zone,
} from '../../layout/player/PlayerButtons';
import { DeckSeek } from './DeckSeek';

const LEFT = 'col-start-1 flex items-center gap-2.5 justify-self-end';
const RIGHT = 'col-start-3 flex items-center gap-2.5 justify-self-start';
const TRAY_GROUP = 'flex flex-wrap items-center justify-center gap-2.5';

const SEEK_MIN = 260;
const GAP = 10;
const FLANK_SIZES = [46, 40];
const FLANK_MAX_ITEMS = 4;
const TRAY_SIZE = 40;
const NEAR_STEPS = [
  { size: 40, gap: 0 },
  { size: 34, gap: 8 },
  { size: 30, gap: 4 },
];
const PREV = 48;
const PLAY = 76;
const WIDE_ITEM = '[data-ui="player-quality"]';

interface Fit {
  tray: boolean;
  size: number;
  side: number;
  near: number;
  nearGap: number;
}

interface GroupSize {
  items: number;
  units: number;
}

function groupSize(group: Element | null): GroupSize {
  let items = 0;
  let units = 0;
  for (const slot of group?.children ?? []) {
    const button = slot.firstElementChild;
    if (!button) continue;
    if (button.matches(WIDE_ITEM)) {
      items += 1;
      units += 2;
    } else if (getComputedStyle(button).display !== 'none') {
      items += 1;
      units += 1;
    }
  }
  return { items, units };
}

function span(group: GroupSize, size: number, gap: number) {
  return group.units * size + Math.max(0, group.items - 1) * gap;
}

function sideFit(width: number, left: GroupSize, right: GroupSize) {
  const tray = { tray: true, size: TRAY_SIZE, side: 0 };
  if (Math.max(left.items, right.items) > FLANK_MAX_ITEMS) return tray;
  for (const size of FLANK_SIZES) {
    const side = Math.max(span(left, size, GAP), span(right, size, GAP));
    if (2 * side + SEEK_MIN + 2 * GAP <= width) return { tray: false, size, side };
  }
  return tray;
}

function nearFit(width: number, between: number, before: GroupSize, after: GroupSize) {
  const last = NEAR_STEPS[NEAR_STEPS.length - 1];
  for (const step of NEAR_STEPS) {
    const gap = step.gap || between;
    const side = (group: GroupSize) =>
      group.items === 0 ? PREV : span(group, step.size, gap) + between + PREV;
    if (2 * Math.max(side(before), side(after)) + PLAY + 2 * between <= width) {
      return { near: step.size, nearGap: gap };
    }
  }
  return { near: last.size, nearGap: last.gap };
}

function sameFit(a: Fit, b: Fit) {
  return (
    a.tray === b.tray &&
    a.size === b.size &&
    a.side === b.side &&
    a.near === b.near &&
    a.nearGap === b.nearGap
  );
}

function useDeckFit() {
  const ref = useRef<HTMLDivElement>(null);
  const layout = usePlacement('deck');
  const [width, setWidth] = useState(0);
  const [fit, setFit] = useState<Fit>({
    tray: false,
    size: FLANK_SIZES[0],
    side: 0,
    near: 40,
    nearGap: 20,
  });

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
    const zone = (name: string) => groupSize(root.querySelector(`[data-zone="${name}"]`));
    const transport = root.querySelector('[data-ui="player-transport"]');
    const between = transport ? Number.parseFloat(getComputedStyle(transport).columnGap) || 0 : 0;
    const next = {
      ...sideFit(width, zone('left'), zone('right')),
      ...nearFit(width, between, zone('before'), zone('after')),
    };
    setFit((prev) => (sameFit(prev, next) ? prev : next));
  }, [width, layout]);

  return { ref, fit };
}

export function DeckControls({
  ctx,
  onContextMenu,
}: {
  ctx: PlayerContext;
  onContextMenu: MouseEventHandler;
}) {
  const { ref, fit } = useDeckFit();
  const style = {
    '--deck-btn': `${fit.size}px`,
    '--deck-near': `${fit.near}px`,
    '--deck-near-gap': `${fit.nearGap}px`,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      data-ui="deck-controls"
      data-fit={fit.tray ? 'tray' : 'flank'}
      onContextMenu={onContextMenu}
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
          style={{
            gridTemplateColumns: `minmax(${fit.side}px, 1fr) minmax(${SEEK_MIN}px, 520px) minmax(${fit.side}px, 1fr)`,
          }}
        >
          <Zone zone="left" ctx={ctx} className={LEFT} />
          <DeckSeek />
          <Zone zone="right" ctx={ctx} className={RIGHT} />
        </div>
      )}
      <TransportButtons ctx={ctx} />
      {fit.tray && (
        <div
          data-ui="deck-tray"
          className="flex w-full flex-wrap items-center justify-center gap-x-7 gap-y-3"
        >
          <Zone zone="left" ctx={ctx} className={TRAY_GROUP} />
          <Zone zone="right" ctx={ctx} className={TRAY_GROUP} />
        </div>
      )}
      <HiddenPopovers surface="deck" ctx={ctx} />
    </div>
  );
}
