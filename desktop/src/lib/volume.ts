export const VOLUME_MAX = 200;
export const VOLUME_SNAP_POINTS = [50, 100, 150, 200];

const SNAP_RADIUS_PX = 2;
const FINE_DRAG_RATIO = 4;

export function clampVolume(value: number, max = VOLUME_MAX): number {
  return Math.max(0, Math.min(max, value));
}

export function snapVolume(
  value: number,
  unitsPerPx: number,
  points: readonly number[] = VOLUME_SNAP_POINTS,
): number {
  const radius = Math.max(1, Math.round(SNAP_RADIUS_PX * unitsPerPx));
  return points.find((point) => Math.abs(value - point) <= radius) ?? value;
}

export function fineDragVolume(anchorVolume: number, anchorValue: number, value: number): number {
  return clampVolume(anchorVolume + (value - anchorValue) / FINE_DRAG_RATIO);
}
