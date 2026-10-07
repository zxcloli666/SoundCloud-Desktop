import { useMemo } from 'react';
import { useSettingsStore } from '../stores/settings';
import {
  LAYOUT_IDS,
  type LayoutId,
  type LayoutScope,
  type ResolvedEntry,
  resolveLayout,
} from './layout';

export function useLayout<S extends LayoutScope>(scope: S): ResolvedEntry<LayoutId<S>>[] {
  const saved = useSettingsStore((s) => s.layouts[scope]);
  return useMemo(
    () => resolveLayout<LayoutId<S>>(saved, LAYOUT_IDS[scope] as readonly LayoutId<S>[]),
    [saved, scope],
  );
}

export function useVisibleBlocks<S extends LayoutScope>(scope: S): LayoutId<S>[] {
  const layout = useLayout(scope);
  return useMemo(() => layout.filter((e) => !e.hidden).map((e) => e.id), [layout]);
}
