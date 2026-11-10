import auroraTile from './aurora.tile.webp';
import aurora from './aurora.webp';
import candySkyTile from './candy-sky.tile.webp';
import candySky from './candy-sky.webp';
import dunesTile from './dunes.tile.webp';
import dunes from './dunes.webp';
import mistyForestTile from './misty-forest.tile.webp';
import mistyForest from './misty-forest.webp';
import oceanRaysTile from './ocean-rays.tile.webp';
import oceanRays from './ocean-rays.webp';
import paperTile from './paper.tile.webp';
import paper from './paper.webp';
import pastelLakeTile from './pastel-lake.tile.webp';
import pastelLake from './pastel-lake.webp';
import peachCloudsTile from './peach-clouds.tile.webp';
import peachClouds from './peach-clouds.webp';
import satinTile from './satin.tile.webp';
import satin from './satin.webp';
import snowLampTile from './snow-lamp.tile.webp';
import snowLamp from './snow-lamp.webp';
import sunsetCloudsTile from './sunset-clouds.tile.webp';
import sunsetClouds from './sunset-clouds.webp';
import type { BackdropPreset } from './types';
import vinylTile from './vinyl.tile.webp';
import vinyl from './vinyl.webp';
import watercolorTile from './watercolor.tile.webp';
import watercolor from './watercolor.webp';

export const PRESETS: readonly BackdropPreset[] = [
  {
    id: 'aurora',
    image: aurora,
    tile: auroraTile,
    tone: 'dark',
    light: { mean: 0.0249, low: 0.0062, high: 0.0511 },
  },
  {
    id: 'vinyl',
    image: vinyl,
    tile: vinylTile,
    tone: 'dark',
    light: { mean: 0.0236, low: 0.0023, high: 0.0695 },
  },
  {
    id: 'sunset-clouds',
    image: sunsetClouds,
    tile: sunsetCloudsTile,
    tone: 'dark',
    light: { mean: 0.0402, low: 0.0057, high: 0.097 },
  },
  {
    id: 'ocean-rays',
    image: oceanRays,
    tile: oceanRaysTile,
    tone: 'dark',
    light: { mean: 0.039, low: 0.0055, high: 0.0994 },
  },
  {
    id: 'dunes',
    image: dunes,
    tile: dunesTile,
    tone: 'dark',
    light: { mean: 0.0558, low: 0.0069, high: 0.1257 },
  },
  {
    id: 'misty-forest',
    image: mistyForest,
    tile: mistyForestTile,
    tone: 'dark',
    light: { mean: 0.102, low: 0.0064, high: 0.3028 },
  },
  {
    id: 'snow-lamp',
    image: snowLamp,
    tile: snowLampTile,
    tone: 'dark',
    light: { mean: 0.0334, low: 0.0037, high: 0.0716 },
  },
  {
    id: 'satin',
    image: satin,
    tile: satinTile,
    tone: 'dark',
    light: { mean: 0.0272, low: 0.0036, high: 0.0655 },
  },
  {
    id: 'paper',
    image: paper,
    tile: paperTile,
    tone: 'light',
    light: { mean: 0.6765, low: 0.5946, high: 0.7354 },
  },
  {
    id: 'peach-clouds',
    image: peachClouds,
    tile: peachCloudsTile,
    tone: 'light',
    light: { mean: 0.6925, low: 0.564, high: 0.8181 },
  },
  {
    id: 'pastel-lake',
    image: pastelLake,
    tile: pastelLakeTile,
    tone: 'light',
    light: { mean: 0.6232, low: 0.4518, high: 0.7748 },
  },
  {
    id: 'watercolor',
    image: watercolor,
    tile: watercolorTile,
    tone: 'light',
    light: { mean: 0.8116, low: 0.7457, high: 0.8641 },
  },
  {
    id: 'candy-sky',
    image: candySky,
    tile: candySkyTile,
    tone: 'light',
    light: { mean: 0.8355, low: 0.7511, high: 0.9158 },
  },
];

const BY_ID = new Map(PRESETS.map((preset) => [preset.id as string, preset]));

export function presetOf(id: string | null | undefined): BackdropPreset | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}
