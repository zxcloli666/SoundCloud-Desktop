import { GROUP_GAP_MS } from '../../../lib/chat/time';
import type { Message, Seq } from '../../../lib/chat/types';
import type { UnreadMark } from '../../../stores/chat/thread';

export type Row =
  | { kind: 'day'; key: string; ts: number }
  | { kind: 'unread'; key: string; count: number }
  | { kind: 'system'; key: string; message: Message }
  | { kind: 'message'; key: string; message: Message; first: boolean; last: boolean };

function dayNumber(ts: number): number {
  const date = new Date(ts);
  return date.getFullYear() * 10_000 + date.getMonth() * 100 + date.getDate();
}

function joins(a: Message, b: Message, day: number, prevDay: number): boolean {
  return (
    a.body.type !== 'system' &&
    a.sender === b.sender &&
    a.mine === b.mine &&
    day === prevDay &&
    b.ts - a.ts < GROUP_GAP_MS
  );
}

function isDeleteMarker(message: Message): boolean {
  return message.body.type === 'system' && message.body.kind === 'deleted';
}

function startsUnread(message: Message, unread: UnreadMark): boolean {
  return message.seq !== null && message.seq > unread.after && !message.mine;
}

export function buildRows(messages: Message[], unread: UnreadMark | null): Row[] {
  const rows: Row[] = [];
  const days = new Set<number>();
  let unreadPlaced = unread === null;
  let prev: Message | null = null;
  let prevDay = -1;
  let lastMessageRow = -1;

  for (const message of messages) {
    if (isDeleteMarker(message)) continue;
    const day = dayNumber(message.ts);
    let broken = prev === null || !joins(prev, message, day, prevDay);
    if (day !== prevDay && !days.has(day)) {
      days.add(day);
      rows.push({ kind: 'day', key: `day:${day}`, ts: message.ts });
      broken = true;
    }
    if (!unreadPlaced && unread && startsUnread(message, unread)) {
      rows.push({ kind: 'unread', key: 'unread', count: unread.count });
      unreadPlaced = true;
      broken = true;
    }
    if (broken && lastMessageRow >= 0) {
      const row = rows[lastMessageRow];
      if (row.kind === 'message') row.last = true;
    }
    if (message.body.type === 'system') {
      rows.push({ kind: 'system', key: message.clientId, message });
      lastMessageRow = -1;
    } else {
      rows.push({ kind: 'message', key: message.clientId, message, first: broken, last: false });
      lastMessageRow = rows.length - 1;
    }
    prev = message;
    prevDay = day;
  }

  if (lastMessageRow >= 0) {
    const row = rows[lastMessageRow];
    if (row.kind === 'message') row.last = true;
  }
  return rows;
}

export function rowIndexOfSeq(rows: Row[], seq: Seq): number {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if ((row.kind === 'message' || row.kind === 'system') && row.message.seq === seq) return i;
  }
  return -1;
}

export function lastSeqUpTo(rows: Row[], index: number): Seq | null {
  for (let i = Math.min(index, rows.length - 1); i >= 0; i--) {
    const row = rows[i];
    if ((row.kind === 'message' || row.kind === 'system') && row.message.seq !== null) {
      return row.message.seq;
    }
  }
  return null;
}

export function unseenBelow(rows: Row[], index: number, readSeq: Seq): number {
  let count = 0;
  for (let i = index + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.kind !== 'message' || row.message.mine) continue;
    if (row.message.seq !== null && row.message.seq > readSeq) count += 1;
  }
  return count;
}

const CHAR_PX = 7.3;
const BUBBLE_MAX_PX = 560;
const BUBBLE_SHARE = 0.82;
const BUBBLE_PADDING_PX = 26;
const META_CHARS = 9;

export function lineChars(width: number): number {
  const bubble = Math.min(width * BUBBLE_SHARE, BUBBLE_MAX_PX) - BUBBLE_PADDING_PX;
  return Math.max(12, Math.floor(bubble / CHAR_PX));
}

function textLines(text: string, perLine: number): number {
  let lines = 0;
  let last = 0;
  for (const part of text.split('\n')) {
    lines += Math.max(1, Math.ceil(part.length / perLine));
    last = part.length % perLine;
  }
  return last > perLine - META_CHARS ? lines + 1 : lines;
}

export function estimateRow(row: Row, perLine: number): number {
  if (row.kind === 'day' || row.kind === 'unread') return 46;
  if (row.kind === 'system') return 44;
  const { message } = row;
  const text = message.body.type === 'text' ? message.body.text : '';
  const extras =
    message.embeds.length * 96 +
    (message.replyTo !== null ? 45 : 0) +
    (message.reactions.length > 0 ? 30 : 0) +
    (row.first ? 26 : 0);
  return 19 + textLines(text, perLine) * 20 + extras;
}
