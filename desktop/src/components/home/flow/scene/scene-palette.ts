import { type Rgb, sampleCover } from '../../../../lib/cover-palette';
import type { SceneColors } from './ambient-matter';

type Cluster = { color: Rgb; weight: number };
export type ScenePalette = { colors: SceneColors; key: string };

const SAMPLE_SIZE = 48;
const CACHE_LIMIT = 48;
const cache = new Map<string, Promise<ScenePalette | null>>();

const luma = ([r, g, b]: Rgb) => r * 0.2126 + g * 0.7152 + b * 0.0722;
const distance = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const chromaOf = (color: Rgb) => Math.max(...color) - Math.min(...color);
const hex = (color: Rgb) =>
  `#${color.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

function hasColor(color: Rgb) {
  const high = Math.max(...color);
  const chroma = chromaOf(color);
  return high >= 24 && chroma >= 9 && (chroma >= 24 || chroma / high >= 0.16);
}

function mergeColor(target: Cluster, added: Cluster) {
  const total = target.weight + added.weight;
  target.color = target.color.map(
    (value, i) => (value * target.weight + added.color[i] * added.weight) / total,
  ) as Rgb;
  target.weight = total;
}

function binPixels(pixels: Uint8ClampedArray) {
  const bins = new Map<number, Cluster>();
  let total = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const weight = pixels[i + 3] / 255;
    if (weight < 0.5) continue;
    const color: Rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = ((color[0] >> 4) << 8) | ((color[1] >> 4) << 4) | (color[2] >> 4);
    const old = bins.get(key);
    if (old) mergeColor(old, { color, weight });
    else bins.set(key, { color, weight });
    total += weight;
  }
  return { bins, total };
}

function clusterBins(bins: Map<number, Cluster>) {
  const clusters: Cluster[] = [];
  for (const bin of [...bins.values()].sort((a, b) => b.weight - a.weight)) {
    let closest: Cluster | undefined;
    let closestDistance = 56 ** 2;
    for (const candidate of clusters) {
      const d = distance(bin.color, candidate.color);
      if (d >= closestDistance) continue;
      closest = candidate;
      closestDistance = d;
    }
    if (closest) mergeColor(closest, bin);
    else clusters.push(bin);
  }
  return clusters.sort((a, b) => b.weight - a.weight);
}

function fromPixels(pixels: Uint8ClampedArray): ScenePalette | null {
  const { bins, total } = binPixels(pixels);
  if (!total) return null;
  const clusters = clusterBins(bins);
  const dominant = clusters[0];
  const common = clusters.filter((cluster) => cluster.weight / total >= 0.075);
  const score = (cluster: Cluster) =>
    (cluster.weight / total) * 1.6 +
    chromaOf(cluster.color) / 255 +
    Math.min(1, luma(cluster.color) / 180) * 0.18;
  const colourful = clusters
    .filter((cluster) => cluster.weight / total >= 0.018 && hasColor(cluster.color))
    .sort((a, b) => score(b) - score(a));
  const chromatic = colourful[0] ?? common.find((cluster) => hasColor(cluster.color));
  const dark = Math.max(...dominant.color) < 40 && luma(dominant.color) < 28;
  const contrast = dark
    ? common.find(
        (cluster) =>
          Math.max(...cluster.color) >= 50 && luma(cluster.color) > luma(dominant.color) + 20,
      )
    : undefined;
  const first = chromatic ?? contrast ?? dominant;
  const apart = (cluster: Cluster) =>
    cluster !== first && distance(cluster.color, first.color) > 48 ** 2;
  const second = contrast ? dominant : (colourful.find(apart) ?? common.find(apart) ?? first);
  const light = common.reduce(
    (best, cluster) => (luma(cluster.color) > luma(best.color) ? cluster : best),
    dominant,
  );
  const neutralDark = dark && !chromatic && !contrast && chromaOf(dominant.color) <= 8;
  const neutralLight = !chromatic && luma(first.color) > 208 && chromaOf(first.color) <= 28;
  const neutral = neutralDark || neutralLight;
  const ink = dominant.color.map((n) => Math.round(n * 0.085)) as Rgb;
  const primary: Rgb = neutral ? [38, 38, 42] : first.color;
  const secondary: Rgb = neutral ? [10, 10, 12] : second.color;
  const highlight: Rgb = neutral ? [104, 104, 112] : light.color;
  return {
    colors: [ink, primary, secondary, highlight],
    key: `cover:${hex(primary)}:${hex(secondary)}`,
  };
}

export function extractScenePalette(source: string): Promise<ScenePalette | null> {
  const known = cache.get(source);
  if (known) return known;
  const pending = sampleCover(source, SAMPLE_SIZE, fromPixels);
  cache.set(source, pending);
  if (cache.size > CACHE_LIMIT) {
    const first = cache.keys().next();
    if (!first.done) cache.delete(first.value);
  }
  return pending;
}
