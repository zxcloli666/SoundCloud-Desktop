export type QueueGroup = 'added' | 'context' | 'auto';
export type RowTone = 'played' | 'now' | 'next';

export const ROW_SIZE = 56;
export const SECTION_SIZE = 44;
export const PLAYED_SIZE = 46;
export const HINT_SIZE = 40;

export type QueueItem =
  | { kind: 'played'; key: string; size: number; count: number; open: boolean }
  | { kind: 'track'; key: string; size: number; index: number; tone: RowTone }
  | {
      kind: 'section';
      key: string;
      size: number;
      group: QueueGroup;
      count: number;
      autoplay: boolean;
    }
  | { kind: 'hint'; key: string; size: number };

export interface QueueShape {
  ids: string[];
  groups: QueueGroup[];
  queueIndex: number;
  playedOpen: boolean;
  autoplayFooter: boolean;
}

interface Run {
  group: QueueGroup;
  from: number;
  to: number;
}

export function queueIds(urns: string[]): string[] {
  const seen = new Map<string, number>();
  return urns.map((urn) => {
    const n = seen.get(urn) ?? 0;
    seen.set(urn, n + 1);
    return `${urn}#${n}`;
  });
}

export function groupRuns(groups: QueueGroup[], start: number): Run[] {
  const runs: Run[] = [];
  for (let i = start; i < groups.length; i++) {
    const last = runs[runs.length - 1];
    if (last && last.group === groups[i]) last.to = i + 1;
    else runs.push({ group: groups[i], from: i, to: i + 1 });
  }
  return runs;
}

export function buildQueueItems(shape: QueueShape): QueueItem[] {
  const { ids, groups, queueIndex, playedOpen, autoplayFooter } = shape;
  const items: QueueItem[] = [];
  const track = (index: number, tone: RowTone): QueueItem => ({
    kind: 'track',
    key: ids[index],
    size: ROW_SIZE,
    index,
    tone,
  });

  const played = Math.min(Math.max(0, queueIndex), ids.length);
  if (played > 0) {
    items.push({
      kind: 'played',
      key: 'played',
      size: PLAYED_SIZE,
      count: played,
      open: playedOpen,
    });
    if (playedOpen) {
      for (let i = 0; i < played; i++) items.push(track(i, 'played'));
      if (queueIndex < ids.length) items.push(track(queueIndex, 'now'));
    }
  }

  const runs = groupRuns(groups, Math.max(0, queueIndex + 1));
  runs.forEach((run, n) => {
    items.push({
      kind: 'section',
      key: `section:${run.from}`,
      size: SECTION_SIZE,
      group: run.group,
      count: run.to - run.from,
      autoplay: run.group === 'auto' && n === runs.length - 1,
    });
    for (let i = run.from; i < run.to; i++) items.push(track(i, 'next'));
  });

  if (autoplayFooter && runs[runs.length - 1]?.group !== 'auto') {
    items.push({
      kind: 'section',
      key: 'section:autoplay',
      size: SECTION_SIZE,
      group: 'auto',
      count: 0,
      autoplay: true,
    });
    items.push({ kind: 'hint', key: 'hint', size: HINT_SIZE });
  }
  return items;
}

export function groupAfterMove(groups: QueueGroup[], from: number, to: number): QueueGroup | null {
  return groups[to] === groups[from] ? null : groups[to];
}
