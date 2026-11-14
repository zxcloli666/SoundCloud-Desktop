import type { SettingsResult } from '../../../lib/settings-search/useSettingsSearch';
import { findTarget } from './findTarget';

const WAIT_MS = 1500;
const CARD_GRACE_MS = 400;
const POLL_MS = 60;
const FLASH_MS = 1700;
const EDGE_GAP = 24;

let current = 0;

function flash(element: HTMLElement, kind: 'row' | 'card') {
  element.removeAttribute('data-search-flash');
  void element.offsetWidth;
  element.setAttribute('data-search-flash', kind);
  setTimeout(() => element.removeAttribute('data-search-flash'), FLASH_MS);
}

function layoutTop(element: HTMLElement): number {
  let top = 0;
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.offsetParent as HTMLElement | null
  ) {
    top += node.offsetTop;
  }
  return top;
}

function centre(element: HTMLElement) {
  const main = document.querySelector<HTMLElement>('[data-ui="main"]');
  if (!main) return;
  const height = element.offsetHeight;
  const room = main.clientHeight - height;
  const offset = room > EDGE_GAP * 2 ? room / 2 : EDGE_GAP;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  main.scrollTo({
    top: Math.max(0, layoutTop(element) - layoutTop(main) - offset),
    behavior: reduced ? 'auto' : 'smooth',
  });
}

export function cancelReveal() {
  current++;
}

export async function revealResult(result: SettingsResult) {
  const run = ++current;
  const started = performance.now();
  let cardSeen = 0;
  while (run === current && performance.now() - started < WAIT_MS) {
    await new Promise((done) => setTimeout(done, POLL_MS));
    if (run !== current) return;
    const { element, fallback } = findTarget(result);
    const now = performance.now();
    if (fallback && cardSeen === 0) cardSeen = now;
    const target = element ?? (fallback && now - cardSeen > CARD_GRACE_MS ? fallback : null);
    if (!target) continue;
    centre(target);
    flash(target, target === element && result.kind === 'row' ? 'row' : 'card');
    return;
  }
  if (run !== current) return;
  const { fallback } = findTarget(result);
  if (fallback) {
    centre(fallback);
    flash(fallback, 'card');
  }
}
