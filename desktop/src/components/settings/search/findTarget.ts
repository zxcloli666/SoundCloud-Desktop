import type { SettingsResult } from '../../../lib/settings-search/useSettingsSearch';

export interface Target {
  element: HTMLElement | null;
  fallback: HTMLElement | null;
}

function ownText(element: Element): string {
  return [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();
}

function findCard(titles: string[]): HTMLElement | null {
  const cards = document.querySelectorAll<HTMLElement>('[data-page="settings"] section');
  return (
    [...cards].find((card) =>
      titles.includes(card.querySelector('h3')?.textContent?.trim() ?? ''),
    ) ?? null
  );
}

function findRow(titles: string[], scope: ParentNode): HTMLElement | null {
  for (const row of scope.querySelectorAll<HTMLElement>('[data-ui="settings-row"]')) {
    for (const element of row.querySelectorAll('*')) {
      if (titles.includes(ownText(element))) return row;
    }
  }
  return null;
}

export function findTarget(result: SettingsResult): Target {
  if (result.kind === 'card') return { element: findCard(result.titles), fallback: null };
  const card = findCard(result.cardTitles);
  const scope = card ?? document.querySelector('[data-ui="main"]');
  return { element: scope ? findRow(result.titles, scope) : null, fallback: card };
}
