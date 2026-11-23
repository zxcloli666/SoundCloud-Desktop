import { usePlayerStore } from '../../../stores/player';
import { getTrackDisplay } from '../../track-display';
import {
  ARTIST_MAX,
  clipped,
  fitted,
  labelOf,
  roleOf,
  type Screen,
  type ScreenRow,
  type SeenControl,
  TITLE_MAX,
  TRACKS_SHOWN,
  trimmed,
  VALUE_MAX,
} from './shape';
import { screenTrack, TRACK_MARK } from './tracks';

const INTERACTIVE = [
  'button',
  'a[href]',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="option"]',
  '[role="slider"]',
  '[role="combobox"]',
].join(',');
const DIALOGS = '[role="dialog"],[role="alertdialog"],[aria-modal="true"]';
const POPUPS = '[role="menu"],[role="listbox"]';
const MAIN = '[data-ui="main"]';
const EDGE = 8;

interface Found extends SeenControl {
  el: HTMLElement;
}

const refOf = new WeakMap<HTMLElement, string>();
const refs = new Map<string, HTMLElement>();
let made = 0;
let rows = new Map<number, string>();

function named(el: HTMLElement): string {
  const known = refOf.get(el);
  if (known) return known;
  made += 1;
  const ref = `c${made}`;
  refOf.set(el, ref);
  refs.set(ref, el);
  return ref;
}

function forgetGone() {
  for (const [ref, el] of refs) if (!el.isConnected) refs.delete(ref);
}

function shown(el: Element): boolean {
  const box = el.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return false;
  if (box.bottom < 0 || box.right < 0) return false;
  if (box.top > window.innerHeight || box.left > window.innerWidth) return false;
  return getComputedStyle(el).visibility !== 'hidden';
}

function rootOf(): { root: Element | null; dialog?: string } {
  const open = Array.from(document.querySelectorAll(DIALOGS)).filter(shown);
  const top = open[open.length - 1];
  if (top) return { root: top, dialog: labelOf(top.getAttribute('aria-label'), headingOf(top)) };
  return { root: document.querySelector(MAIN) };
}

function headingOf(root: Element): string {
  const heading = Array.from(root.querySelectorAll('h1,h2,[role="heading"]')).find(shown);
  return clipped(heading?.textContent, 80);
}

function labelled(el: HTMLElement): string {
  const by = el.getAttribute('aria-labelledby');
  const named = by ? document.getElementById(by)?.textContent : null;
  const field = el as HTMLInputElement;
  return labelOf(
    el.getAttribute('aria-label'),
    named,
    el.getAttribute('title'),
    el.innerText,
    field.placeholder,
    el.closest('label')?.textContent,
  );
}

function stateOf(el: HTMLElement, control: SeenControl): SeenControl {
  const checked = el.getAttribute('aria-checked') ?? el.getAttribute('aria-pressed');
  const input = el as HTMLInputElement;
  if (control.role === 'checkbox' || control.role === 'switch') {
    control.on = checked ? checked === 'true' : input.checked === true;
  }
  if (control.role === 'field' || control.role === 'slider' || control.role === 'select') {
    const value = clipped(input.value ?? el.getAttribute('aria-valuenow'), VALUE_MAX);
    if (value) control.value = value;
  }
  const current = el.getAttribute('aria-current') ?? el.getAttribute('aria-selected');
  if (current && current !== 'false') control.current = true;
  return control;
}

function popupsOver(root: Element): Element[] {
  const open = Array.from(document.querySelectorAll(POPUPS)).filter(shown);
  return open.filter((popup) => root.contains(popup) || !popup.closest(DIALOGS));
}

function controlsOf(root: Element): Found[] {
  const popups = popupsOver(root);
  const nodes = [...popups, root].flatMap((part) =>
    Array.from(part.querySelectorAll<HTMLElement>(INTERACTIVE)),
  );
  const found: Found[] = [];
  for (const node of new Set(nodes)) {
    if (node.closest(`[${TRACK_MARK}]`)) continue;
    if (node.closest('[aria-hidden="true"],[inert]')) continue;
    if ((node as HTMLButtonElement).disabled || node.getAttribute('aria-disabled') === 'true')
      continue;
    const role = roleOf(
      node.tagName.toLowerCase(),
      node.getAttribute('type'),
      node.getAttribute('role'),
    );
    if (!role || !shown(node)) continue;
    const label = labelled(node);
    if (!label) continue;
    found.push({ ...stateOf(node, { role, label }), el: node });
  }
  return found;
}

function tracksOf(root: Element): { rows: ScreenRow[]; ids: Map<number, string> } {
  const playing = usePlayerStore.getState().currentTrack?.urn;
  const seen = new Set<string>();
  const out: ScreenRow[] = [];
  const ids = new Map<number, string>();
  for (const node of Array.from(root.querySelectorAll(`[${TRACK_MARK}]`))) {
    if (out.length >= TRACKS_SHOWN) break;
    const id = node.getAttribute(TRACK_MARK);
    const entry = id ? screenTrack(id) : undefined;
    if (!id || !entry || !shown(node)) continue;
    const track = entry.track();
    if (seen.has(track.urn)) continue;
    seen.add(track.urn);
    const shownAs = getTrackDisplay(track);
    const n = out.length + 1;
    ids.set(n, id);
    out.push({
      n,
      title: clipped(shownAs.title, TITLE_MAX),
      artist: clipped(shownAs.artistLine, ARTIST_MAX),
      id: track.urn,
      ...(track.urn === playing ? { playing: true } : {}),
    });
  }
  return { rows: out, ids };
}

function moreBelow(): boolean {
  const main = document.querySelector(MAIN);
  return !!main && main.scrollTop + main.clientHeight < main.scrollHeight - EDGE;
}

export function readScreen(page: string): Screen {
  const { root, dialog } = rootOf();
  forgetGone();
  if (!root) {
    rows = new Map();
    return { page, title: '', tracks: [], controls: [], more_below: false };
  }
  const tracks = tracksOf(root);
  const controls = trimmed(controlsOf(root)).map(({ el, ...control }) => ({
    ref: named(el),
    ...control,
  }));
  rows = tracks.ids;
  return fitted({
    page,
    title: headingOf(root) || clipped(document.title, 80),
    ...(dialog !== undefined ? { dialog } : {}),
    tracks: tracks.rows,
    controls,
    more_below: !dialog && moreBelow(),
  });
}

export function elementOf(ref: string): HTMLElement | null {
  const el = refs.get(ref);
  return el?.isConnected ? el : null;
}

export function rowOf(n: number): string | null {
  return rows.get(n) ?? null;
}
