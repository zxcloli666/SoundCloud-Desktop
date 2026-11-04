export interface Size {
  w: number;
  h: number;
}

export interface TileBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface AlbumBox {
  width: number;
  height: number;
  tiles: TileBox[];
}

export const ALBUM_WIDTH = 380;
export const ALBUM_GAP = 2;

const SINGLE_MAX_HEIGHT = 420;
const SINGLE_MIN_WIDTH = 200;
const ROW_MIN = 72;
const ROW_MAX = 280;

const ROWS: Record<number, number[]> = {
  2: [2],
  4: [2, 2],
  5: [2, 3],
  6: [3, 3],
  7: [3, 4],
  8: [4, 4],
  9: [3, 3, 3],
  10: [3, 3, 4],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ratio(size: Size, min: number, max: number): number {
  const raw = size.w > 0 && size.h > 0 ? size.w / size.h : 1;
  return clamp(raw, min, max);
}

function single(size: Size): AlbumBox {
  const aspect = ratio(size, 0.5, 2.4);
  let width = ALBUM_WIDTH;
  let height = width / aspect;
  if (height > SINGLE_MAX_HEIGHT) {
    height = SINGLE_MAX_HEIGHT;
    width = Math.max(SINGLE_MIN_WIDTH, height * aspect);
  }
  return { width, height, tiles: [{ left: 0, top: 0, width, height }] };
}

function rows(sizes: Size[], pattern: number[]): AlbumBox {
  const tiles: TileBox[] = [];
  let top = 0;
  let start = 0;
  for (const count of pattern) {
    const aspects = sizes.slice(start, start + count).map((size) => ratio(size, 0.66, 1.5));
    const free = ALBUM_WIDTH - ALBUM_GAP * (count - 1);
    const sum = aspects.reduce((total, aspect) => total + aspect, 0);
    const height = clamp(free / sum, ROW_MIN, ROW_MAX);
    let left = 0;
    aspects.forEach((aspect, index) => {
      const width = index === count - 1 ? ALBUM_WIDTH - left : (free * aspect) / sum;
      tiles.push({ left, top, width, height });
      left += width + ALBUM_GAP;
    });
    top += height + ALBUM_GAP;
    start += count;
  }
  return { width: ALBUM_WIDTH, height: top - ALBUM_GAP, tiles };
}

function three(sizes: Size[]): AlbumBox {
  const first = ratio(sizes[0], 0.5, 2.4);
  if (first >= 1.2) return rows(sizes, [1, 2]);
  const big = Math.round(ALBUM_WIDTH * 0.64);
  const side = ALBUM_WIDTH - big - ALBUM_GAP;
  const height = clamp(big / first, 220, 340);
  const half = (height - ALBUM_GAP) / 2;
  return {
    width: ALBUM_WIDTH,
    height,
    tiles: [
      { left: 0, top: 0, width: big, height },
      { left: big + ALBUM_GAP, top: 0, width: side, height: half },
      { left: big + ALBUM_GAP, top: half + ALBUM_GAP, width: side, height: half },
    ],
  };
}

function fallbackRows(count: number): number[] {
  const pattern: number[] = [];
  let left = count;
  while (left > 0) {
    const take = left === 4 ? 2 : Math.min(3, left);
    pattern.push(take);
    left -= take;
  }
  return pattern;
}

export function albumLayout(sizes: Size[]): AlbumBox {
  if (sizes.length === 0) return { width: ALBUM_WIDTH, height: 0, tiles: [] };
  if (sizes.length === 1) return single(sizes[0]);
  if (sizes.length === 3) return three(sizes);
  return rows(sizes, ROWS[sizes.length] ?? fallbackRows(sizes.length));
}

export function tileStyle(box: AlbumBox, tile: TileBox) {
  return {
    left: `${(tile.left / box.width) * 100}%`,
    top: `${(tile.top / box.height) * 100}%`,
    width: `${(tile.width / box.width) * 100}%`,
    height: `${(tile.height / box.height) * 100}%`,
  };
}

export function fitInside(size: Size, width: number, height: number): Size {
  if (size.w <= 0 || size.h <= 0) {
    const side = Math.max(1, Math.min(width, height));
    return { w: side, h: side };
  }
  const scale = Math.min(width / size.w, height / size.h, 1);
  return { w: Math.max(1, size.w * scale), h: Math.max(1, size.h * scale) };
}
