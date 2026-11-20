export const COVER_MIN = 300;
export const COVER_MAX = 1000;
const ZOOM_LIMIT = 4;

export type CoverFrame = { x: number; y: number; side: number };
export type CoverSize = { width: number; height: number };

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export function coverTooSmall(size: CoverSize): boolean {
  return Math.min(size.width, size.height) < COVER_MIN;
}

export function maxZoom(size: CoverSize): number {
  return clamp(Math.min(size.width, size.height) / COVER_MIN, 1, ZOOM_LIMIT);
}

export function zoomOf(frame: CoverFrame, size: CoverSize): number {
  return Math.min(size.width, size.height) / frame.side;
}

export function fullFrame(size: CoverSize): CoverFrame {
  return { x: size.width / 2, y: size.height / 2, side: Math.min(size.width, size.height) };
}

export function clampFrame(frame: CoverFrame, size: CoverSize): CoverFrame {
  const full = Math.min(size.width, size.height);
  const side = clamp(frame.side, full / maxZoom(size), full);
  const half = side / 2;
  return {
    side,
    x: clamp(frame.x, half, size.width - half),
    y: clamp(frame.y, half, size.height - half),
  };
}

export function zoomFrame(frame: CoverFrame, zoom: number, size: CoverSize): CoverFrame {
  return clampFrame({ ...frame, side: Math.min(size.width, size.height) / zoom }, size);
}

export function panFrame(
  frame: CoverFrame,
  dx: number,
  dy: number,
  viewport: number,
  size: CoverSize,
): CoverFrame {
  const scale = frame.side / viewport;
  return clampFrame({ ...frame, x: frame.x - dx * scale, y: frame.y - dy * scale }, size);
}

export function outputSide(frame: CoverFrame): number {
  return Math.round(Math.min(COVER_MAX, frame.side));
}
