import { goTo } from '../chat/navigator';
import type { ItemKind, ScrollTo } from './shape';
import { elementOf, rowOf } from './snapshot';
import { screenTrack } from './tracks';

const MAIN = '[data-ui="main"]';
const PAGE_SHARE = 0.8;

const ROUTES: Record<ItemKind, string> = {
  track: '/track/',
  artist: '/artist/',
  album: '/album/',
  playlist: '/playlist/',
  user: '/user/',
};

export function press(ref: string): boolean {
  const el = elementOf(ref);
  if (!el) return false;
  el.focus({ preventScroll: true });
  el.click();
  return true;
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set?.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function typeInto(ref: string, text: string, submit: boolean): boolean {
  const el = elementOf(ref);
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  el.focus({ preventScroll: true });
  setValue(el, text);
  if (!submit) return true;
  if (el.form) el.form.requestSubmit();
  else el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return true;
}

export function scrollPage(to: ScrollTo): boolean {
  const main = document.querySelector(MAIN);
  if (!main) return false;
  const step = main.clientHeight * PAGE_SHARE;
  const top = {
    down: main.scrollTop + step,
    up: main.scrollTop - step,
    top: 0,
    bottom: main.scrollHeight,
  }[to];
  main.scrollTo({ top, behavior: 'instant' });
  return true;
}

export function playRow(n: number): boolean {
  const id = rowOf(n);
  const entry = id ? screenTrack(id) : undefined;
  if (!entry) return false;
  entry.start();
  return true;
}

export function openItem(kind: ItemKind, id: string): boolean {
  const route = ROUTES[kind];
  return !!route && !!id.trim() && goTo(`${route}${encodeURIComponent(id.trim())}`);
}
