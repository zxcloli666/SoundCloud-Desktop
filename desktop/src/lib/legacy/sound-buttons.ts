import type { LayoutEntry, LayoutState } from '../layout';

const MERGED: ReadonlySet<string> = new Set(['abLoop', 'sleep', 'tuning', 'eq', 'effects']);

export function soundFromButtons(layouts: LayoutState): LayoutState {
  return { ...layouts, player: merge(layouts.player), deck: merge(layouts.deck) };
}

function merge(saved: readonly LayoutEntry[]): LayoutEntry[] {
  const shown = saved.find((entry) => MERGED.has(entry.id) && !entry.hidden);
  const placed = saved.some((entry) => entry.id === 'sound');
  return saved.flatMap((entry) => {
    if (entry === shown && !placed) return [soundAt(entry)];
    if (MERGED.has(entry.id)) return [];
    if (entry.id === 'sound' && shown) return [{ ...entry, hidden: false }];
    return [entry];
  });
}

function soundAt({ id, zone }: LayoutEntry): LayoutEntry {
  return { id: 'sound', hidden: false, zone: zone ?? (id === 'abLoop' ? 'after' : 'right') };
}
