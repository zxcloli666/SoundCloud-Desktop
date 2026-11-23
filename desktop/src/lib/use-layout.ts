import { useMemo } from 'react';
import { selectChatInNav, useChatStore } from '../stores/chat';
import { useSettingsStore } from '../stores/settings';
import {
  DEFAULT_HIDDEN,
  gatedIds,
  LAYOUT_IDS,
  type LayoutId,
  type LayoutScope,
  type ResolvedEntry,
  resolveLayout,
  resolvePlacement,
} from './layout';
import { isSurface, type Placed, type PlayerButtonId, type Surface } from './player-zones';

export function useLayout<S extends LayoutScope>(scope: S): ResolvedEntry<LayoutId<S>>[] {
  const saved = useSettingsStore((s) => s.layouts[scope]);
  const chatShown = useChatStore(selectChatInNav);
  return useMemo(
    () =>
      isSurface(scope)
        ? (resolvePlacement(saved, scope) as ResolvedEntry<LayoutId<S>>[])
        : resolveLayout<LayoutId<S>>(
            saved,
            LAYOUT_IDS[scope] as readonly LayoutId<S>[],
            gatedIds(chatShown),
            DEFAULT_HIDDEN[scope],
          ),
    [saved, scope, chatShown],
  );
}

export function usePlacement(surface: Surface): Placed<PlayerButtonId>[] {
  const saved = useSettingsStore((s) => s.layouts[surface]);
  return useMemo(() => resolvePlacement(saved, surface), [saved, surface]);
}

export function useVisibleBlocks<S extends LayoutScope>(scope: S): LayoutId<S>[] {
  const layout = useLayout(scope);
  return useMemo(() => layout.filter((e) => !e.hidden).map((e) => e.id), [layout]);
}

export function useToggleLayoutEntry(scope: LayoutScope): (id: string) => void {
  const layout = useLayout(scope);
  const setLayout = useSettingsStore((s) => s.setLayout);
  return (id) =>
    setLayout(
      scope,
      layout.map((e) => (e.id === id ? { ...e, hidden: !e.hidden } : e)),
    );
}
