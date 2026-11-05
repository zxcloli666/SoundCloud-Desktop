import { useMemo } from 'react';
import { selectChatEnabled, useChatStore } from '../stores/chat';
import { useSettingsStore } from '../stores/settings';
import {
  gatedIds,
  LAYOUT_IDS,
  type LayoutId,
  type LayoutScope,
  type ResolvedEntry,
  resolveLayout,
} from './layout';

export function useLayout<S extends LayoutScope>(scope: S): ResolvedEntry<LayoutId<S>>[] {
  const saved = useSettingsStore((s) => s.layouts[scope]);
  const chatEnabled = useChatStore(selectChatEnabled);
  return useMemo(
    () =>
      resolveLayout<LayoutId<S>>(
        saved,
        LAYOUT_IDS[scope] as readonly LayoutId<S>[],
        gatedIds(chatEnabled),
      ),
    [saved, scope, chatEnabled],
  );
}

export function useVisibleBlocks<S extends LayoutScope>(scope: S): LayoutId<S>[] {
  const layout = useLayout(scope);
  return useMemo(() => layout.filter((e) => !e.hidden).map((e) => e.id), [layout]);
}
