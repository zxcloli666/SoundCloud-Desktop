import type { ZoneIds } from './player-zones';

const GAP = 2;
const BUTTON = 34;
const QUALITY = 72;
const VOLUME_WITH_SLIDER = 154;
const TRANSPORT = 122;
const COLUMN_GAP = 12;
const PADDING = 36;
const ART_AND_TITLE = 120;
const SLIDER_FROM = 1120;

export function fitsOneRow(ids: ZoneIds, dockWidth: number): boolean {
  const side = Math.max(
    ART_AND_TITLE + zoneWidth(ids.left, dockWidth) + zoneWidth(ids.before, dockWidth),
    zoneWidth(ids.after, dockWidth) + zoneWidth(ids.right, dockWidth),
  );
  return 2 * (side + COLUMN_GAP) + TRANSPORT <= dockWidth - PADDING;
}

function zoneWidth(ids: readonly string[], dockWidth: number): number {
  const buttons = ids.reduce((sum, id) => sum + buttonWidth(id, dockWidth), 0);
  return buttons + GAP * Math.max(0, ids.length - 1);
}

function buttonWidth(id: string, dockWidth: number): number {
  if (id === 'quality') return QUALITY;
  if (id === 'volume' && dockWidth >= SLIDER_FROM) return VOLUME_WITH_SLIDER;
  return BUTTON;
}
