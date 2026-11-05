import { decodeThumbhash, encodeThumbhash } from './thumbhash';

export type MediaMark = 'deleted' | 'lost' | 'failed';

const BROKEN = 'data:image/png;base64,bad';
const RATIOS = [4 / 3, 3 / 4, 16 / 9, 1, 3 / 2, 9 / 16];
const LONG_SIDE: Record<string, number> = {
  thumb: 320,
  'upload-thumb': 320,
  avatar: 96,
  image: 1200,
  'upload-image': 1200,
};

const sizes = new Map<string, [number, number]>();
const marks = new Map<string, MediaMark>();
const cache = new Map<string, string>();
const hashes = new Map<string, number[]>();

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function random(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function pictureSize(id: string): [number, number] {
  const known = sizes.get(id);
  if (known) return known;
  if (id.startsWith('avatar')) return [1, 1];
  const ratio = RATIOS[hash(id) % RATIOS.length];
  return ratio >= 1 ? [Math.round(ratio * 1000), 1000] : [1000, Math.round(1000 / ratio)];
}

export function setPictureSize(id: string, w: number, h: number) {
  sizes.set(id, [w, h]);
}

export function markMedia(ids: string[], mark: MediaMark | null) {
  for (const id of ids) {
    if (mark) marks.set(id, mark);
    else marks.delete(id);
  }
}

export function mediaMark(id: string): MediaMark | null {
  return marks.get(id) ?? null;
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number) {
  const hue = rand() * 360;
  const sky = ctx.createLinearGradient(0, 0, w * rand(), h);
  sky.addColorStop(0, `hsl(${hue} 78% 62%)`);
  sky.addColorStop(1, `hsl(${(hue + 50 + rand() * 80) % 360} 70% 38%)`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const blobs = 4 + Math.floor(rand() * 5);
  for (let i = 0; i < blobs; i++) {
    ctx.globalAlpha = 0.18 + rand() * 0.4;
    ctx.fillStyle = `hsl(${(hue + rand() * 160) % 360} ${55 + rand() * 35}% ${40 + rand() * 40}%)`;
    ctx.beginPath();
    const r = Math.min(w, h) * (0.12 + rand() * 0.35);
    if (rand() < 0.6) ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
    else ctx.roundRect(rand() * w, rand() * h, r * 1.8, r * 1.1, r * 0.3);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const ground = ctx.createLinearGradient(0, h * 0.62, 0, h);
  ground.addColorStop(0, 'rgb(0 0 0 / 0)');
  ground.addColorStop(1, 'rgb(0 0 0 / 0.42)');
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
}

function drawPlaceholder(id: string): string {
  const decoded = decodeThumbhash(thumbhashOf(id));
  const canvas = document.createElement('canvas');
  const ctx = decoded && canvas.getContext('2d');
  if (!decoded || !ctx) return BROKEN;
  canvas.width = decoded.w;
  canvas.height = decoded.h;
  ctx.putImageData(new ImageData(decoded.rgba, decoded.w, decoded.h), 0, 0);
  return canvas.toDataURL('image/png');
}

function draw(id: string, variant: string): string {
  if (variant === 'placeholder') return drawPlaceholder(id);
  const [rw, rh] = pictureSize(id);
  const long = LONG_SIDE[variant] ?? LONG_SIDE.image;
  const scale = long / Math.max(rw, rh);
  const w = Math.max(2, Math.round(rw * scale));
  const h = Math.max(2, Math.round(rh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return BROKEN;
  paint(ctx, w, h, random(hash(id)));
  return canvas.toDataURL('image/jpeg', 0.82);
}

export function labPicture(
  _conversationId: string,
  mediaId: string,
  variant: string,
): string | null {
  if (mediaMark(mediaId)) return BROKEN;
  const key = `${mediaId}/${variant}`;
  let url = cache.get(key);
  if (!url) {
    url = draw(mediaId, variant);
    cache.set(key, url);
  }
  return url;
}

export function labAvatar(name: string): string {
  return labPicture('', `avatar-${name}`, 'avatar') ?? BROKEN;
}

export function installLabPictures() {
  (window as { __chatLabMedia?: typeof labPicture }).__chatLabMedia = labPicture;
}

export function thumbhashOf(mediaId: string): number[] {
  const known = hashes.get(mediaId);
  if (known) return known;
  const image = labPixels(mediaId);
  const hash = image ? encodeThumbhash(image.width, image.height, image.data) : [];
  if (hash.length > 0) hashes.set(mediaId, hash);
  return hash;
}

function labPixels(mediaId: string, longSide = 32): ImageData | null {
  const [rw, rh] = pictureSize(mediaId);
  const scale = longSide / Math.max(rw, rh);
  const w = Math.max(1, Math.round(rw * scale));
  const h = Math.max(1, Math.round(rh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  paint(ctx, w, h, random(hash(mediaId)));
  return ctx.getImageData(0, 0, w, h);
}
