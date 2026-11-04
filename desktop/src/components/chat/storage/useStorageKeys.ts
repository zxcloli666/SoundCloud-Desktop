import { useEffect } from 'react';
import type { MyMedia } from '../../../lib/chat/media-types';
import { useDeleteStore } from './delete-store';
import { modalOpen, typingTarget } from './focus-later';
import { useSelectionStore } from './selection-store';

function take(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function useStorageKeys(items: MyMedia[], onDelete: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || modalOpen() || typingTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const selection = useSelectionStore.getState();
      if (mod && event.code === 'KeyA') {
        take(event);
        selection.pickAll(items.map((item) => item.id));
      } else if (mod && event.code === 'KeyZ' && useDeleteStore.getState().undo) {
        take(event);
        void useDeleteStore.getState().restore();
      } else if (event.key === 'Escape' && selection.picked.size > 0) {
        take(event);
        selection.clear();
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selection.picked.size > 0
      ) {
        take(event);
        onDelete();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [items, onDelete]);
}
