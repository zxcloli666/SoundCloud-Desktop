const ROLE_TAG_HEAD = new Set([
  'cover',
  'covers',
  'remix',
  'rmx',
  'edit',
  'version',
  'mix',
  'feat',
  'feat.',
  'ft',
  'ft.',
  'featuring',
  'prod',
  'prod.',
  'produced',
  'with',
  'vs',
  'vs.',
  'instrumental',
  'acoustic',
  'live',
  'demo',
  'bootleg',
  'flip',
  'mashup',
  'original',
  'extended',
  'radio',
  'free',
  'official',
  'premiere',
  'exclusive',
  'lyrics',
  'lyric',
  'visualizer',
  'hq',
  'hd',
  'sped',
  'speed',
  'slowed',
  'reverb',
  'nightcore',
  'remaster',
  'remastered',
]);
const ROLE_TAG_TAIL = new Set([
  'remix',
  'rmx',
  'edit',
  'mix',
  'version',
  'cover',
  'bootleg',
  'flip',
  'mashup',
  'instrumental',
  'acoustic',
  'sped',
  'slowed',
  'reverb',
  'nightcore',
  'remaster',
  'remastered',
]);

export function looksLikeRoleTag(inner: string): boolean {
  const lower = inner.trim().toLowerCase();
  const parts = lower.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;
  return ROLE_TAG_HEAD.has(parts[0]) || ROLE_TAG_TAIL.has(parts[parts.length - 1]);
}

/**
 * Хвостовая транскрипция в скобках: "МОКЕРИ (moxckery)" → срезаем. Триггер:
 * outer имеет non-Latin codepoint (>U+02AF), inner — чисто ASCII-латиница.
 * Role-теги ("трек (cover)") не трогаем.
 * "Beyoncé (Sasha Fierce)" не срезается (обе стороны latin).
 */
export function stripTranslitParens(s: string): string {
  const trimmed = s.replace(/\s+$/, '');
  if (!trimmed.endsWith(')')) return s;
  const open = trimmed.lastIndexOf('(');
  if (open <= 0) return s;
  const outer = trimmed.slice(0, open).replace(/\s+$/, '');
  const inner = trimmed.slice(open + 1, -1);
  if (!outer || !inner) return s;
  if (looksLikeRoleTag(inner)) return s;
  let outerHasNonLatin = false;
  for (const ch of outer) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp > 0x02af && /\p{L}/u.test(ch)) {
      outerHasNonLatin = true;
      break;
    }
  }
  const innerLatinOnly = /^[A-Za-z\s\-'`.]+$/.test(inner) && /[A-Za-z]/.test(inner);
  return outerHasNonLatin && innerLatinOnly ? outer : s;
}

const NOISE_TAG = /\s*[([]([^)\]]*)[)\]]/g;
const NOISE_PHRASE =
  /^(?:free\s+(?:dl|download)|out\s+now|premiere|exclusive|official(?:\s+(?:audio|video|music\s+video|lyric\s+video|visualizer))?|lyrics?(?:\s+video)?|visualizer|hd|hq)$/i;

export function stripNoiseTags(title: string): string {
  const next = title
    .replace(NOISE_TAG, (tag, inner: string) => (NOISE_PHRASE.test(inner.trim()) ? '' : tag))
    .replace(/\s{2,}/g, ' ')
    .trim();
  return next || title;
}

const ROLE_TAG_PATTERN =
  /\s*[([][^)\]]*\b(?:prod\.?|produced\s+by|prod\s+by|feat\.?|featuring|ft\.?|remix|rmx|edit|version|cover|instrumental|original\s+mix|extended\s+mix|radio\s+edit)\b[^)\]]*[)\]]/gi;

export function stripRoleTags(title: string): string {
  let prev = title;
  for (let i = 0; i < 4; i++) {
    const next = prev
      .replace(ROLE_TAG_PATTERN, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (next === prev) break;
    prev = next;
  }
  return prev || title;
}
