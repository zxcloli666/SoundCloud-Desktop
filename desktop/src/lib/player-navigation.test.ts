import { describe, expect, it } from 'vitest';
import { nextQueueIndex, previousQueueIndex } from './player-navigation';

describe('queue navigation', () => {
  it('does nothing for an empty queue', () => {
    expect(nextQueueIndex(0, -1, 'off')).toBeNull();
    expect(previousQueueIndex(0, -1)).toBeNull();
  });

  it('starts at the first item when no queue item is selected', () => {
    expect(nextQueueIndex(3, -1, 'off')).toBe(0);
  });

  it('stops at the end unless repeat-all is enabled', () => {
    expect(nextQueueIndex(3, 2, 'off')).toBeNull();
    expect(nextQueueIndex(3, 2, 'one')).toBeNull();
    expect(nextQueueIndex(3, 2, 'all')).toBe(0);
  });

  it('never moves previous before the first item', () => {
    expect(previousQueueIndex(3, 0)).toBe(0);
    expect(previousQueueIndex(3, 2)).toBe(1);
  });
});
