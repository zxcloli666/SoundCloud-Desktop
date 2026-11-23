import type { Virtualizer } from '@tanstack/react-virtual';
import type React from 'react';
import { usePlayerStore } from '../../../stores/player';
import { playQueueIndex } from './QueueRow';
import type { QueueItem } from './queue-items';

const focusable = (item: QueueItem | undefined) =>
  item?.kind === 'track' || item?.kind === 'played';

export function queueKeyHandler(
  items: QueueItem[],
  virtualizer: Virtualizer<HTMLElement, Element>,
  rootRef: React.RefObject<HTMLDivElement | null>,
) {
  const nodeAt = (at: number) => rootRef.current?.querySelector<HTMLElement>(`[data-q-at="${at}"]`);

  const focusAt = (at: number) => {
    virtualizer.scrollToIndex(at, { align: 'auto' });
    requestAnimationFrame(() => nodeAt(at)?.focus({ preventScroll: true }));
  };

  const seek = (from: number, step: number) => {
    for (let at = from; at >= 0 && at < items.length; at += step) {
      if (focusable(items[at])) return at;
    }
    return -1;
  };

  const move = (from: number, step: number) => {
    const at = seek(from, step);
    if (at >= 0) focusAt(at);
  };

  return (event: React.KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (!target.hasAttribute('data-q-at')) return;
    const at = Number(target.dataset.qAt);
    const item = items[at];
    const track = item?.kind === 'track' ? item : null;
    switch (event.key) {
      case 'ArrowDown':
        move(at + 1, 1);
        break;
      case 'ArrowUp':
        move(at - 1, -1);
        break;
      case 'Home':
        move(0, 1);
        break;
      case 'End':
        move(items.length - 1, -1);
        break;
      case 'Enter':
        if (!track) return;
        playQueueIndex(track.index);
        break;
      case 'Delete':
      case 'Backspace':
        if (!track || track.tone === 'now') return;
        usePlayerStore.getState().removeFromQueue(track.index);
        requestAnimationFrame(() => (nodeAt(at) ?? nodeAt(at - 1))?.focus({ preventScroll: true }));
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
}
