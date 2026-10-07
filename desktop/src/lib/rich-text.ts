export type RichToken =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'mention'; text: string; permalink: string }
  | { kind: 'time'; text: string; seconds: number };

const TOKEN =
  /(https?:\/\/[^\s<>"'`]+|(?:www\.)?soundcloud\.com\/[^\s<>"'`]+)|(^|[^\w@./-])@([\w-]{1,64})|(^|[^\w:.])((?:\d{1,2}:)?\d{1,2}:\d{2})(?![\w:])/gi;
const TRAILING = /[).,!?»;:\]}…*'"]+$/;

export function timecodeSeconds(raw: string): number | null {
  const parts = raw.split(':').map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, ...parts];
  if (s >= 60 || (parts.length === 3 && m >= 60)) return null;
  return h * 3600 + m * 60 + s;
}

function linkHref(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function parseRichText(text: string, maxSeconds?: number | null): RichToken[] {
  const tokens: RichToken[] = [];
  const push = (token: RichToken) => {
    const last = tokens[tokens.length - 1];
    if (token.kind === 'text' && last?.kind === 'text') last.text += token.text;
    else if (token.kind !== 'text' || token.text) tokens.push(token);
  };

  let cursor = 0;
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    push({ kind: 'text', text: text.slice(cursor, start) });
    cursor = start + match[0].length;

    const [, url, mentionLead, permalink, timeLead, time] = match;
    if (url) {
      const clean = url.replace(TRAILING, '');
      push({ kind: 'link', text: clean, href: linkHref(clean) });
      push({ kind: 'text', text: url.slice(clean.length) });
    } else if (permalink) {
      push({ kind: 'text', text: mentionLead });
      push({ kind: 'mention', text: `@${permalink}`, permalink });
    } else {
      push({ kind: 'text', text: timeLead });
      const seconds = timecodeSeconds(time);
      const seekable = maxSeconds != null && seconds != null && seconds <= maxSeconds;
      push(seekable ? { kind: 'time', text: time, seconds } : { kind: 'text', text: time });
    }
  }
  push({ kind: 'text', text: text.slice(cursor) });
  return tokens;
}
