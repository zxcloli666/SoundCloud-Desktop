import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Virtualizer } from '@tanstack/react-virtual';
import { remeasure } from '../src/components/chat/thread/remeasure.ts';

const ESTIMATE = 60;

interface FakeRow {
  height: number;
  isConnected: boolean;
  getAttribute(name: string): string | null;
}

function rowsOf(heights: number[]): FakeRow[] {
  return heights.map((height, index) => ({
    height,
    isConnected: true,
    getAttribute: (name) => (name === 'data-index' ? String(index) : null),
  }));
}

function mounted(rows: FakeRow[]): Virtualizer<Element, Element> {
  const virtualizer = new Virtualizer<Element, Element>({
    count: rows.length,
    estimateSize: () => ESTIMATE,
    initialRect: { width: 600, height: 4000 },
    getScrollElement: () => null,
    scrollToFn: () => {},
    observeElementRect: () => {},
    observeElementOffset: () => {},
    measureElement: (node) => (node as unknown as FakeRow).height,
  });
  virtualizer.getVirtualItems();
  for (const row of rows) virtualizer.measureElement(row as unknown as Element);
  return virtualizer;
}

function starts(virtualizer: Virtualizer<Element, Element>): number[] {
  return virtualizer.getVirtualItems().map((item) => item.start);
}

test('albums laid out before their images load keep their height when the line width changes', () => {
  const virtualizer = mounted(rowsOf([46, 420, 52, 380, 46]));
  assert.deepEqual(starts(virtualizer), [0, 46, 466, 518, 898]);
  remeasure(virtualizer);
  assert.deepEqual(starts(virtualizer), [0, 46, 466, 518, 898]);
  assert.equal(virtualizer.getTotalSize(), 944);
});

test('a bare measure drops mounted rows back to the estimate, which is what stacked albums', () => {
  const virtualizer = mounted(rowsOf([46, 420, 52, 380, 46]));
  virtualizer.measure();
  assert.deepEqual(starts(virtualizer), [0, 60, 120, 180, 240]);
});

test('a row that grew since its first measure moves the rows below it', () => {
  const rows = rowsOf([46, 420, 52]);
  const virtualizer = mounted(rows);
  rows[1].height = 510;
  remeasure(virtualizer);
  assert.deepEqual(starts(virtualizer), [0, 46, 556]);
});

test('rows that left the page fall back to the estimate', () => {
  const rows = rowsOf([46, 420, 52]);
  const virtualizer = mounted(rows);
  rows[1].isConnected = false;
  remeasure(virtualizer);
  assert.deepEqual(starts(virtualizer), [0, 46, 46 + ESTIMATE]);
});
