const SIZE = 96;

let tile: HTMLCanvasElement | null = null;

export function grainTile(): HTMLCanvasElement {
  if (tile) return tile;
  tile = document.createElement('canvas');
  tile.width = SIZE;
  tile.height = SIZE;
  const context = tile.getContext('2d');
  if (!context) return tile;
  const pixels = context.createImageData(SIZE, SIZE);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = Math.random();
    const shade = value > 0.5 ? 255 : 0;
    pixels.data[i] = shade;
    pixels.data[i + 1] = shade;
    pixels.data[i + 2] = shade;
    pixels.data[i + 3] = Math.round(Math.abs(value - 0.5) * 2 * 90);
  }
  context.putImageData(pixels, 0, 0);
  return tile;
}
