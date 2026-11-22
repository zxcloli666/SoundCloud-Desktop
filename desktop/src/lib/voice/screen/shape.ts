export const TRACKS_SHOWN = 20;
export const CONTROLS_SHOWN = 40;
export const SAME_LABEL_SHOWN = 2;
export const LABEL_MAX = 48;
export const VALUE_MAX = 40;
export const TITLE_MAX = 60;
export const ARTIST_MAX = 40;
export const SCREEN_BYTES = 5 * 1024;

export const SCROLLS = ['down', 'up', 'top', 'bottom'] as const;
export type ScrollTo = (typeof SCROLLS)[number];

export const ITEM_KINDS = ['track', 'artist', 'album', 'playlist', 'user'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export type ControlRole =
  | 'button'
  | 'link'
  | 'tab'
  | 'switch'
  | 'checkbox'
  | 'option'
  | 'menuitem'
  | 'slider'
  | 'field'
  | 'select';

export interface SeenControl {
  role: ControlRole;
  label: string;
  value?: string;
  on?: boolean;
  current?: boolean;
}

export interface ScreenControl extends SeenControl {
  ref: string;
}

export interface ScreenRow {
  n: number;
  title: string;
  artist: string;
  id: string;
  playing?: boolean;
}

export interface Screen {
  page: string;
  title: string;
  dialog?: string;
  tracks: ScreenRow[];
  controls: ScreenControl[];
  more_below: boolean;
}

const SPACES = /\s+/g;

export function clipped(text: string | null | undefined, max: number): string {
  const one = (text ?? '').replace(SPACES, ' ').trim();
  const chars = Array.from(one);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : one;
}

export function labelOf(...said: (string | null | undefined)[]): string {
  for (const text of said) {
    const label = clipped(text, LABEL_MAX);
    if (label) return label;
  }
  return '';
}

const BY_ROLE: Record<string, ControlRole> = {
  button: 'button',
  link: 'link',
  tab: 'tab',
  switch: 'switch',
  checkbox: 'checkbox',
  radio: 'checkbox',
  option: 'option',
  menuitem: 'menuitem',
  menuitemcheckbox: 'checkbox',
  slider: 'slider',
  textbox: 'field',
  searchbox: 'field',
  combobox: 'select',
};

const PRESSED_INPUTS = new Set(['button', 'submit', 'reset']);
const CHECKED_INPUTS = new Set(['checkbox', 'radio']);

export function roleOf(tag: string, type: string | null, role: string | null): ControlRole | null {
  if (role && BY_ROLE[role]) return BY_ROLE[role];
  if (tag === 'button') return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'field';
  if (tag !== 'input') return null;
  const kind = (type ?? 'text').toLowerCase();
  if (kind === 'hidden') return null;
  if (PRESSED_INPUTS.has(kind)) return 'button';
  if (CHECKED_INPUTS.has(kind)) return 'checkbox';
  if (kind === 'range') return 'slider';
  return 'field';
}

export function trimmed<T extends SeenControl>(seen: T[]): T[] {
  const times = new Map<string, number>();
  const kept: T[] = [];
  for (const control of seen) {
    if (kept.length >= CONTROLS_SHOWN) break;
    const key = `${control.role}:${control.label.toLowerCase()}`;
    const count = (times.get(key) ?? 0) + 1;
    times.set(key, count);
    if (count <= SAME_LABEL_SHOWN) kept.push(control);
  }
  return kept;
}

const encoder = new TextEncoder();

function sizeOf(screen: Screen): number {
  return encoder.encode(JSON.stringify(screen)).length;
}

export function fitted(screen: Screen, bytes = SCREEN_BYTES): Screen {
  let fit = screen;
  while (sizeOf(fit) > bytes && fit.tracks.length + fit.controls.length > 0) {
    fit =
      fit.controls.length >= fit.tracks.length
        ? { ...fit, controls: fit.controls.slice(0, -1) }
        : { ...fit, tracks: fit.tracks.slice(0, -1) };
  }
  return fit;
}
