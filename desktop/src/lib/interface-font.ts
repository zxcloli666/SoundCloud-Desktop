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

let applySeq = 0;

export async function applyFontVars(
  font: InterfaceFont,
  customName: string,
  root: HTMLElement = document.documentElement,
) {
  const seq = ++applySeq;
  await loadBundledFont(font);
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
