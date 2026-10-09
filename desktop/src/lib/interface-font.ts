import { appDataDir, join } from '@tauri-apps/api/path';
import { mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';

export type InterfaceFont =
  | 'inter'
  | 'manrope'
  | 'onest'
  | 'golos'
  | 'montserrat'
  | 'rubik'
  | 'nunito'
  | 'raleway'
  | 'comfortaa'
  | 'system'
  | 'custom';

interface FontDef {
  family: string;
  load?: () => Promise<unknown>;
}

export const BUNDLED_FONTS: Record<Exclude<InterfaceFont, 'custom'>, FontDef> = {
  inter: { family: '"Inter"' },
  manrope: {
    family: '"Manrope Variable"',
    load: () => import('@fontsource-variable/manrope/index.css'),
  },
  onest: { family: '"Onest Variable"', load: () => import('@fontsource-variable/onest/index.css') },
  golos: {
    family: '"Golos Text Variable"',
    load: () => import('@fontsource-variable/golos-text/index.css'),
  },
  montserrat: {
    family: '"Montserrat Variable"',
    load: () => import('@fontsource-variable/montserrat/index.css'),
  },
  rubik: { family: '"Rubik Variable"', load: () => import('@fontsource-variable/rubik/index.css') },
  nunito: {
    family: '"Nunito Variable"',
    load: () => import('@fontsource-variable/nunito/index.css'),
  },
  raleway: {
    family: '"Raleway Variable"',
    load: () => import('@fontsource-variable/raleway/index.css'),
  },
  comfortaa: {
    family: '"Comfortaa Variable"',
    load: () => import('@fontsource-variable/comfortaa/index.css'),
  },
  system: { family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"' },
};

export const FONT_OPTIONS = Object.keys(BUNDLED_FONTS) as Exclude<InterfaceFont, 'custom'>[];

const FALLBACK_STACK =
  '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

export function sanitizeFontName(name: string): string {
  return name
    .replace(/["'`;{}()\\<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

export function fontFamilyOf(font: InterfaceFont, customName: string): string | null {
  if (font === 'custom') {
    const name = sanitizeFontName(customName);
    return name ? `"${name}"` : null;
  }
  return BUNDLED_FONTS[font]?.family ?? null;
}

export function fontStack(font: InterfaceFont, customName: string): string {
  const family = fontFamilyOf(font, customName);
  return family && font !== 'inter' ? `${family}, ${FALLBACK_STACK}` : FALLBACK_STACK;
}

export function loadBundledFont(font: InterfaceFont): Promise<unknown> {
  if (font === 'custom') return Promise.resolve();
  return BUNDLED_FONTS[font]?.load?.().catch(() => undefined) ?? Promise.resolve();
}

const FONTS_DIR = 'fonts';
export const FONT_FILE_ACCEPT = '.ttf,.otf,.woff,.woff2';
const uploaded = new Map<string, Promise<boolean>>();

async function fontsDir(): Promise<string> {
  const dir = await join(await appDataDir(), FONTS_DIR);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function registerFace(family: string, data: ArrayBuffer): Promise<boolean> {
  try {
    const face = new FontFace(family, data);
    await face.load();
    document.fonts.add(face);
    return true;
  } catch {
    return false;
  }
}

export function loadUploadedFont(fileName: string, family: string): Promise<boolean> {
  let pending = uploaded.get(fileName);
  if (!pending) {
    pending = fontsDir()
      .then((dir) => join(dir, fileName))
      .then((path) => readFile(path))
      .then((data) => registerFace(family, data.slice().buffer))
      .catch(() => false);
    uploaded.set(fileName, pending);
  }
  return pending;
}

export async function importFontFile(
  file: File,
): Promise<{ family: string; fileName: string } | null> {
  const dot = file.name.lastIndexOf('.');
  const ext = dot > 0 ? file.name.slice(dot).toLowerCase() : '';
  if (!FONT_FILE_ACCEPT.split(',').includes(ext)) return null;
  const family = sanitizeFontName(file.name.slice(0, dot).replace(/[-_]+/g, ' '));
  if (!family) return null;
  const data = new Uint8Array(await file.arrayBuffer());
  if (!(await registerFace(family, data.slice().buffer))) return null;
  const fileName = `${family.replace(/\s+/g, '-')}${ext}`;
  await writeFile(await join(await fontsDir(), fileName), data);
  uploaded.set(fileName, Promise.resolve(true));
  return { family, fileName };
}

export async function removeUploadedFont(fileName: string): Promise<void> {
  uploaded.delete(fileName);
  await remove(await join(await fontsDir(), fileName)).catch(() => undefined);
}

let applySeq = 0;

export async function applyFontVars(
  font: InterfaceFont,
  customName: string,
  customFile: string,
  root: HTMLElement = document.documentElement,
) {
  const seq = ++applySeq;
  await loadBundledFont(font);
  if (font === 'custom' && customFile) {
    await loadUploadedFont(customFile, sanitizeFontName(customName));
  }
  if (seq !== applySeq) return;
  root.style.setProperty('--font-sans', fontStack(font, customName));
}

const PROBE_TEXT = 'mmmmmmmmmmlli WQ Жжщ 0123';

function probeWidth(ctx: CanvasRenderingContext2D, family: string): number {
  ctx.font = `32px ${family}`;
  return ctx.measureText(PROBE_TEXT).width;
}

export function isFontInstalled(name: string): boolean {
  const clean = sanitizeFontName(name);
  if (!clean) return false;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return true;
  return ['monospace', 'serif', 'sans-serif'].some(
    (generic) => probeWidth(ctx, `"${clean}", ${generic}`) !== probeWidth(ctx, generic),
  );
}
