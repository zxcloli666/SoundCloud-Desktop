import type { RichText, Span, SpanKind, UserId } from './types';

export interface Segment {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  spoiler: boolean;
  link: string | null;
  mention: UserId | null;
}

export interface MentionPick {
  userId: UserId;
  name: string;
}

const MARKERS: { token: string; kind: SpanKind }[] = [
  { token: '**', kind: 'bold' },
  { token: '__', kind: 'italic' },
  { token: '||', kind: 'spoiler' },
  { token: '`', kind: 'code' },
];

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const URL_TRAILING = /[).,!?»;:\]}…*'"]+$/;

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

function safeBoundary(text: string, index: number): number {
  const clamped = Math.max(0, Math.min(text.length, index));
  return clamped > 0 && clamped < text.length && isLowSurrogate(text.charCodeAt(clamped))
    ? clamped + 1
    : clamped;
}

export function safeUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function plainSegment(text: string): Segment {
  return {
    text,
    bold: false,
    italic: false,
    code: false,
    spoiler: false,
    link: null,
    mention: null,
  };
}

function cleanSpans(rich: RichText): Span[] {
  return rich.spans
    .map((span) => {
      const start = safeBoundary(rich.text, span.start);
      const end = safeBoundary(rich.text, span.start + span.len);
      return { ...span, start, len: end - start };
    })
    .filter((span) => span.len > 0);
}

function applySpan(segment: Segment, span: Span) {
  if (span.kind === 'bold') segment.bold = true;
  else if (span.kind === 'italic') segment.italic = true;
  else if (span.kind === 'code') segment.code = true;
  else if (span.kind === 'spoiler') segment.spoiler = true;
  else if (span.kind === 'link') segment.link = safeUrl(span.url);
  else if (span.kind === 'mention') segment.mention = span.userId;
}

export function segments(rich: RichText): Segment[] {
  const spans = cleanSpans(rich);
  if (spans.length === 0) return rich.text ? [plainSegment(rich.text)] : [];
  const cuts = new Set([0, rich.text.length]);
  for (const span of spans) {
    cuts.add(span.start);
    cuts.add(span.start + span.len);
  }
  const bounds = [...cuts].sort((a, b) => a - b);
  const result: Segment[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i];
    const to = bounds[i + 1];
    const segment = plainSegment(rich.text.slice(from, to));
    for (const span of spans) {
      if (span.start <= from && span.start + span.len >= to) applySpan(segment, span);
    }
    result.push(segment);
  }
  return result;
}

function markerAt(input: string, index: number) {
  return MARKERS.find((marker) => input.startsWith(marker.token, index)) ?? null;
}

function parseMarkers(input: string, offset: number, spans: Span[]): string {
  let out = '';
  let i = 0;
  while (i < input.length) {
    const marker = markerAt(input, i);
    if (marker) {
      const open = i + marker.token.length;
      const close = input.indexOf(marker.token, open);
      const inner = close > open ? input.slice(open, close) : '';
      if (inner && inner.trim() === inner) {
        const start = offset + out.length;
        const text = marker.kind === 'code' ? inner : parseMarkers(inner, start, spans);
        spans.push({ kind: marker.kind, start, len: text.length, url: null, userId: null });
        out += text;
        i = close + marker.token.length;
        continue;
      }
    }
    out += input[i];
    i += 1;
  }
  return out;
}

function insideCode(spans: Span[], start: number, end: number): boolean {
  return spans.some(
    (span) => span.kind === 'code' && span.start < end && span.start + span.len > start,
  );
}

function linkSpans(text: string, spans: Span[]): Span[] {
  const found: Span[] = [];
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0].replace(URL_TRAILING, '');
    const start = match.index ?? 0;
    const url = safeUrl(raw);
    if (url && !insideCode(spans, start, start + raw.length)) {
      found.push({ kind: 'link', start, len: raw.length, url, userId: null });
    }
  }
  return found;
}

function isNameEnd(text: string, index: number): boolean {
  return index >= text.length || !/[\p{L}\p{N}_]/u.test(text[index]);
}

function mentionSpans(text: string, spans: Span[], picks: MentionPick[]): Span[] {
  const found: Span[] = [];
  for (const pick of picks) {
    const token = `@${pick.name}`;
    let from = text.indexOf(token);
    while (from >= 0) {
      const end = from + token.length;
      if (isNameEnd(text, end) && !insideCode(spans, from, end)) {
        found.push({
          kind: 'mention',
          start: from,
          len: token.length,
          url: null,
          userId: pick.userId,
        });
      }
      from = text.indexOf(token, end);
    }
  }
  return found;
}

export function composeRich(input: string, picks: MentionPick[] = []): RichText {
  const spans: Span[] = [];
  const text = parseMarkers(input.trim(), 0, spans);
  const all = [...spans, ...linkSpans(text, spans), ...mentionSpans(text, spans, picks)];
  return { text, spans: all.sort((a, b) => a.start - b.start || b.len - a.len) };
}

const TOKENS: Partial<Record<SpanKind, string>> = {
  bold: '**',
  italic: '__',
  spoiler: '||',
  code: '`',
};

export function toComposerText(rich: RichText): string {
  const marked = cleanSpans(rich).filter((span) => TOKENS[span.kind]);
  if (marked.length === 0) return rich.text;
  let out = '';
  for (let at = 0; at <= rich.text.length; at++) {
    const closing = marked
      .filter((span) => span.start + span.len === at)
      .sort((a, b) => b.start - a.start);
    const opening = marked.filter((span) => span.start === at).sort((a, b) => b.len - a.len);
    for (const span of [...closing, ...opening]) out += TOKENS[span.kind];
    if (at < rich.text.length) out += rich.text[at];
  }
  return out;
}

export function mentionPicks(rich: RichText): MentionPick[] {
  return rich.spans
    .filter((span) => span.kind === 'mention' && span.userId)
    .map((span) => ({
      userId: span.userId as UserId,
      name: rich.text.slice(span.start + 1, span.start + span.len),
    }));
}

export function sameRich(a: RichText, b: RichText): boolean {
  if (a.text !== b.text || a.spans.length !== b.spans.length) return false;
  return a.spans.every((span, index) => {
    const other = b.spans[index];
    return (
      span.kind === other.kind &&
      span.start === other.start &&
      span.len === other.len &&
      span.url === other.url &&
      span.userId === other.userId
    );
  });
}
