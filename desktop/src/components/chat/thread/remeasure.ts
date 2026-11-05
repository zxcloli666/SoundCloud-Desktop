import type { Virtualizer } from '@tanstack/react-virtual';

export function remeasure<S extends Element | Window, E extends Element>(
  virtualizer: Virtualizer<S, E>,
) {
  virtualizer.measure();
  for (const item of virtualizer.getVirtualItems()) {
    const node = virtualizer.elementsCache.get(item.key);
    if (node?.isConnected) virtualizer.measureElement(node);
  }
}
