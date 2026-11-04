import { useEffect } from 'react';
import type { MyMedia } from '../../../lib/chat/media-types';
import { useDeleteStore } from './delete-store';
import { modalOpen, typingTarget } from './focus-later';
import { useSelectionStore } from './selection-store';

export function useStorageKeys(items: MyMedia[], onDelete: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || modalOpen() || typingTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const selection = useSelectionStore.getState();
      if (mod && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selection.pickAll(items.map((item) => item.id));
      } else if (mod && event.key.toLowerCase() === 'z' && useDeleteStore.getState().undo) {
        event.preventDefault();
        void useDeleteStore.getState().restore();
      } else if (event.key === 'Escape' && selection.picked.size > 0) {
        event.preventDefault();
        selection.clear();
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selection.picked.size > 0
      ) {
        event.preventDefault();
        onDelete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, onDelete]);
}
