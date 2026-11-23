import type { LayoutEntry, LayoutState } from '../layout';

const ON_BY_DEFAULT = ['same_vibe', 'deep_cuts', 'adjacent'];
const OFF_BY_DEFAULT = ['top_artists', 'fresh_drops'];
const CUSTOM = 'custom';

export function layoutsFromRiver(hidden: readonly string[], layouts: LayoutState): LayoutState {
  if (hidden.length === 0) return { ...layouts, stations: [] };
  return {
    ...layouts,
    home: hidden.includes('moments') ? layouts.home : withMoments(layouts.home),
    stations: stationEntries(hidden),
  };
}

function stationEntries(hidden: readonly string[]): LayoutEntry[] {
  const keptOn = hidden.includes(CUSTOM) ? [...ON_BY_DEFAULT, 'discover'] : [];
  return ['wave', ...ON_BY_DEFAULT, ...OFF_BY_DEFAULT, 'discover'].map((id) => ({
    id,
    hidden: id !== 'wave' && !keptOn.includes(id) && hidden.includes(id),
  }));
}

function withMoments(home: readonly LayoutEntry[]): LayoutEntry[] {
  const at = home.findIndex((entry) => entry.id === 'river') + 1;
  return [...home.slice(0, at), { id: 'moments', hidden: false }, ...home.slice(at)];
}
