import { imageSize, THEME_ASSET_NAME, THEME_LIMITS } from './rules.ts';
import type { Position, Token, TokenType } from './css-tokens.ts';
import { asciiLower, tokenize } from './css-tokens.ts';

export type GuardCode =
  | 'size'
  | 'control'
  | 'parse'
  | 'unbalanced'
  | 'at-rule'
  | 'url'
  | 'asset-missing'
  | 'data-uri'
  | 'function'
  | 'image-set'
  | 'attr'
  | 'property';

export type GuardWarning = 'content-text' | 'svg-text';

export interface GuardIssue {
  code: GuardCode | GuardWarning;
  line: number;
  column: number;
  message: string;
}

export interface GuardReport {
  errors: GuardIssue[];
  warnings: GuardIssue[];
  assets: string[];
}

interface Frame {
  open: Token;
  name: string;
  close: TokenType;
  kind: 'url' | 'type' | 'other';
  imageSet: Frame | null;
  parts: Token[];
}

interface Visitor {
  open?: (frame: Frame, parent: Frame | undefined) => void;
  close?: (frame: Frame, end: number, closed: boolean) => void;
  token?: (token: Token, top: Frame | undefined, index: number) => void;
}

interface Cut {
  start: number;
  end: number;
  text: string;
}

const CLOSERS: Partial<Record<TokenType, TokenType>> = {
  function: ')',
  '(': ')',
  '[': ']',
  '{': '}',
};

const ALLOWED_AT_RULES = [
  'media',
  'supports',
  'keyframes',
  '-webkit-keyframes',
  'font-face',
  'layer',
  'container',
  'property',
  'scope',
  'starting-style',
];
const BANNED_FUNCTIONS = [
  'image',
  'src',
  'element',
  '-moz-element',
  'paint',
  'expression',
  '-webkit-canvas',
];
const STRIPPED_FUNCTIONS = ['image', 'src', 'element', '-moz-element', 'paint'];
const IMAGE_SET_FUNCTIONS = ['image-set', '-webkit-image-set', 'cross-fade', '-webkit-cross-fade'];
const DYNAMIC_FUNCTIONS = ['var', 'env', 'attr'];
const BANNED_PROPERTIES = ['behavior', '-moz-binding', 'app-region', '-webkit-app-region'];

const DATA_URI =
  /^data:(image\/(png|jpeg|webp|gif|avif|svg\+xml)|font\/woff2)(;[a-z0-9=._-]+)*(;base64)?,/i;
const IMAGE_MIME = /^image\/(png|jpeg|webp|gif|avif|svg\+xml)$/;
const FRAGMENT = /^#[A-Za-z0-9_-]+$/;
const KEPT_SCHEME = /^(?:data:|blob:|asset:|https?:\/\/asset\.localhost\/)/i;
const KEPT_FRAGMENT = /^#[A-Za-z0-9_-]*$/;
const KEPT_PATH = /^(?!\/\/)[A-Za-z0-9._~%/-]+$/;
const CONTENT_TEXT_LIMIT = 40;

const SVG_PREFIX = '(?:[^\\s<>/="\'&]*:)?';
const SVG_ELEMENT = new RegExp(
  `<\\s*${SVG_PREFIX}(script|foreignobject|iframe|object|embed|handler|listener)\\b`,
  'gi',
);
const SVG_DECLARATION = /<!doctype|<!entity|<\?xml-stylesheet/gi;
const SVG_ENTITY = /&(?!(?:amp|lt|gt|quot|apos);)/gi;
const SVG_BACKSLASH = /\\/g;
const SVG_HANDLER = new RegExp(`[\\s"'/](${SVG_PREFIX}on[a-z]+)\\s*=`, 'gi');
const SVG_BANNED_ATTR = new RegExp(
  `[\\s"'/](${SVG_PREFIX}(?:srcset|poster|base|http-equiv))\\s*=`,
  'gi',
);
const SVG_NAMESPACE = /[\s"'/](xmlns(?::[^\s<>/="'&]*)?)\s*=\s*["']?([^"'\s<>]*)/gi;
const SVG_NAMESPACES = ['http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xlink'];
const SVG_LINK = new RegExp(`(?:^|[\\s"'/])(${SVG_PREFIX}(?:href|src))\\s*=\\s*["']?`, 'gi');
const SVG_ANIMATED_LINK = new RegExp(
  `attributename\\s*=\\s*["']?\\s*${SVG_PREFIX}(?:href|src)\\b`,
  'gi',
);
const SVG_IMPORT = /@import/gi;
const SVG_URL = /url\(\s*["']?/gi;
const SVG_FUNCTION = /\b(image-set|image|src|element|paint|cross-fade)\s*\(/gi;
const SVG_ENCODING = /\bencoding\s*=\s*["']?([\w.:-]*)/gi;
const SVG_NESTED = /data:image\/svg/gi;
const SVG_RASTER = /data:image\/(?:png|jpeg|webp|gif|avif)((?:;[a-z0-9=._-]*)*),([^"'<>)]*)/gi;
const SVG_TEXT = new RegExp(`<\\s*${SVG_PREFIX}text\\b`, 'gi');
const SVG_SAFE_TARGET = /^(?:#|data:image\/)/i;

function walk(tokens: Token[], end: number, visitor: Visitor) {
  const stack: Frame[] = [];
  tokens.forEach((token, index) => {
    const top: Frame | undefined = stack[stack.length - 1];
    const close = CLOSERS[token.type];
    if (close) {
      const name = token.type === 'function' ? asciiLower(token.value) : '';
      const typeArg =
        name === 'type' && top !== undefined && IMAGE_SET_FUNCTIONS.includes(top.name);
      const frame: Frame = {
        open: token,
        name,
        close,
        kind: name === 'url' ? 'url' : typeArg ? 'type' : 'other',
        imageSet: top ? top.imageSet : null,
        parts: [],
      };
      if (IMAGE_SET_FUNCTIONS.includes(name)) frame.imageSet = frame;
      if (top?.name) top.parts.push(token);
      visitor.open?.(frame, top);
      stack.push(frame);
    } else if (top && token.type === top.close) {
      stack.pop();
      visitor.close?.(top, token.end, true);
    } else {
      if (top?.name && token.type !== 'whitespace') top.parts.push(token);
      visitor.token?.(token, top, index);
    }
  });
  for (let frame = stack.pop(); frame; frame = stack.pop()) visitor.close?.(frame, end, false);
}

function applyCuts(css: string, cuts: Cut[]): { css: string; blocked: number } {
  cuts.sort((a, b) => a.start - b.start || b.end - a.end);
  let out = '';
  let last = 0;
  let blocked = 0;
  for (const cut of cuts) {
    if (cut.start < last) continue;
    out += css.slice(last, cut.start) + cut.text;
    last = cut.end;
    blocked++;
  }
  return { css: out + css.slice(last), blocked };
}

function isSingleString(parts: Token[]): boolean {
  return parts.length === 1 && parts[0].type === 'string';
}

function firstControl(text: string): number {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c <= 8 || c === 11 || (c >= 14 && c <= 31) || c === 127) return i;
  }
  return -1;
}

function assetName(value: string): string | null {
  if (!value.startsWith('assets/')) return null;
  const name = value.slice(7);
  return THEME_ASSET_NAME.test(name) ? name : null;
}

function isKeptUrl(raw: string): boolean {
  const value = normalizeUrlValue(raw);
  return (
    value === '' || KEPT_SCHEME.test(value) || KEPT_FRAGMENT.test(value) || KEPT_PATH.test(value)
  );
}

function rasterProblem(body: string, base64: boolean): string | null {
  let binary: string;
  try {
    binary = base64
      ? atob(body)
      : body.replace(/%([0-9a-f]{2})/gi, (_hit, hex: string) =>
          String.fromCharCode(Number.parseInt(hex, 16)),
        );
  } catch {
    return 'image cannot be decoded';
  }
  const size = imageSize(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  if (!size) return 'image cannot be read';
  if (Math.max(size.width, size.height) > THEME_LIMITS.assetMaxSide) {
    return `image is ${size.width}x${size.height}, too big`;
  }
  return null;
}

function excerpt(text: string, from: number): string {
  return text.slice(from, from + 40).split(/[\r\n]/)[0];
}

export function normalizeUrlValue(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) <= 0x20) start++;
  while (end > start && value.charCodeAt(end - 1) <= 0x20) end--;
  let out = '';
  for (let i = start; i < end; i++) {
    const c = value.charCodeAt(i);
    if (c !== 9 && c !== 10 && c !== 13) out += value[i];
  }
  return out;
}

export function inspectThemeCss(css: string, assetNames: readonly string[]): GuardReport {
  const errors: GuardIssue[] = [];
  const warnings: GuardIssue[] = [];
  const assets = new Set<string>();

  if (new TextEncoder().encode(css).length > THEME_LIMITS.cssBytes) {
    errors.push({ code: 'size', line: 1, column: 1, message: 'theme.css is too big' });
    return { errors, warnings, assets: [] };
  }

  const error = (code: GuardCode, at: Position, message: string) => {
    errors.push({ code, line: at.line, column: at.column, message });
  };
  const warn = (code: GuardWarning, at: Position, message: string) => {
    warnings.push({ code, line: at.line, column: at.column, message });
  };

  const scan = tokenize(css);
  const control = firstControl(css);
  if (control >= 0) error('control', scan.locate(control), 'control character');
  for (const problem of scan.problems) error('parse', scan.locate(problem.offset), problem.message);

  const checkDataUri = (value: string, at: Token) => {
    const head = DATA_URI.exec(value);
    if (!head) return error('data-uri', at, 'data: must be an image or woff2');
    if (value.length > THEME_LIMITS.dataUriChars) return error('data-uri', at, 'data: is too long');
    if (/^data:font\//i.test(value)) return;
    const body = value.slice(head[0].length);
    const base64 = /;base64,$/i.test(head[0]);
    if (!/^data:image\/svg\+xml/i.test(value)) {
      const problem = rasterProblem(body, base64);
      if (problem) error('data-uri', at, `data: ${problem}`);
      return;
    }
    let svg: string;
    try {
      svg = base64 ? atob(body) : decodeURIComponent(body);
    } catch {
      return error('data-uri', at, 'data: svg cannot be decoded');
    }
    const result = inspectSvg(svg);
    if (result.errors.length > 0) error('data-uri', at, `data: svg: ${result.errors[0]}`);
    if (result.warnings.length > 0) warn('svg-text', at, 'data: svg has text');
  };

  const checkUrl = (raw: string, at: Token) => {
    const value = normalizeUrlValue(raw);
    if (/^data:/i.test(value)) return checkDataUri(value, at);
    if (/[\0- \x7f\\]/.test(value)) {
      return error('url', at, 'url has a space, control or backslash');
    }
    const name = assetName(value);
    if (name) {
      assets.add(name);
      if (!assetNames.includes(name)) error('asset-missing', at, `no file assets/${name}`);
    } else if (!FRAGMENT.test(value)) {
      error('url', at, 'url must be assets/<file>, #id or data:');
    }
  };

  let declaration: Token | null = null;
  let declarationChars = 0;
  const endDeclaration = () => {
    if (declaration && declarationChars > CONTENT_TEXT_LIMIT) {
      warn('content-text', declaration, `${declarationChars} characters of text`);
    }
    declaration = null;
    declarationChars = 0;
  };

  walk(scan.tokens, css.length, {
    open(frame, parent) {
      if (BANNED_FUNCTIONS.includes(frame.name)) {
        error('function', frame.open, `${frame.name}() is not allowed`);
      }
      if (parent?.imageSet && DYNAMIC_FUNCTIONS.includes(frame.name)) {
        error('image-set', frame.open, `${frame.name}() inside ${parent.imageSet.name}()`);
      }
      if (frame.close === '}') endDeclaration();
    },
    close(frame, _end, closed) {
      if (!closed) error('unbalanced', frame.open, `unclosed ${frame.name || frame.open.type}`);
      if (frame.kind === 'url') {
        if (isSingleString(frame.parts)) checkUrl(frame.parts[0].value, frame.open);
        else error('url', frame.open, 'url() must hold one string');
      } else if (frame.kind === 'type') {
        if (!isSingleString(frame.parts) || !IMAGE_MIME.test(frame.parts[0].value)) {
          error('image-set', frame.open, 'type() must name an image type');
        }
      } else if (frame.name === 'attr') {
        const [name, comma, fallback] = frame.parts;
        const plain =
          name?.type === 'ident' &&
          (frame.parts.length === 1 ||
            (frame.parts.length === 3 && comma.type === 'comma' && fallback.type === 'string'));
        if (!plain) error('attr', frame.open, 'attr() takes a name and an optional string');
      }
      if (frame.close === '}') endDeclaration();
    },
    token(token, top, index) {
      if (token.type === 'at-keyword') {
        if (!ALLOWED_AT_RULES.includes(asciiLower(token.value))) {
          error('at-rule', token, `@${token.value} is not allowed`);
        }
      } else if (token.type === 'url') {
        checkUrl(token.value, token);
      } else if (token.type === ')' || token.type === ']' || token.type === '}') {
        error('unbalanced', token, `unexpected ${token.type}`);
      } else if (token.type === 'semicolon') {
        endDeclaration();
      } else if (token.type === 'string') {
        const checkedOnClose = top?.kind === 'url' || top?.kind === 'type';
        if (top?.imageSet && !checkedOnClose) {
          error('image-set', token, `strings are not allowed in ${top.imageSet.name}()`);
        }
        if (top?.name !== 'url' && top?.name !== 'type') declarationChars += token.value.length;
      } else if (token.type === 'ident' && BANNED_PROPERTIES.includes(asciiLower(token.value))) {
        let next = index + 1;
        while (scan.tokens[next]?.type === 'whitespace') next++;
        if (scan.tokens[next]?.type === 'colon') {
          error('property', token, `${token.value} is not allowed`);
        }
      }
      if (!declaration && token.type === 'ident') declaration = token;
    },
  });
  endDeclaration();

  const byPosition = (a: GuardIssue, b: GuardIssue) => a.line - b.line || a.column - b.column;
  return {
    errors: errors.sort(byPosition),
    warnings: warnings.sort(byPosition),
    assets: [...assets].sort(),
  };
}

export function rewriteThemeAssetUrls(css: string, resolve: (name: string) => string): string {
  const cuts: Cut[] = [];
  const rewrite = (raw: string, start: number, end: number) => {
    const name = assetName(normalizeUrlValue(raw));
    if (!name) return;
    const target = resolve(name)
      .replace(/["\\]/g, '\\$&')
      .replace(/[\n\r\f]/g, '');
    cuts.push({ start, end, text: `url("${target}")` });
  };
  walk(tokenize(css).tokens, css.length, {
    close(frame, end) {
      if (frame.kind === 'url' && isSingleString(frame.parts)) {
        rewrite(frame.parts[0].value, frame.open.start, end);
      }
    },
    token(token) {
      if (token.type === 'url') rewrite(token.value, token.start, token.end);
    },
  });
  return applyCuts(css, cuts).css;
}

export function stripRemoteCss(css: string): { css: string; blocked: number } {
  const { tokens } = tokenize(css);
  const cuts: Cut[] = [];
  const badImageSets = new Set<Frame>();
  let importEnd = -1;
  walk(tokens, css.length, {
    open(frame, parent) {
      if (parent?.imageSet && DYNAMIC_FUNCTIONS.includes(frame.name)) {
        badImageSets.add(parent.imageSet);
      }
    },
    close(frame, end) {
      const kept = isSingleString(frame.parts) && isKeptUrl(frame.parts[0].value);
      const removed =
        (frame.kind === 'url' && !kept) ||
        STRIPPED_FUNCTIONS.includes(frame.name) ||
        badImageSets.has(frame);
      if (removed) cuts.push({ start: frame.open.start, end, text: 'none' });
    },
    token(token, top, index) {
      if (token.type === 'at-keyword' && asciiLower(token.value) === 'import') {
        if (token.start < importEnd) return;
        importEnd = css.length;
        const expected: TokenType[] = [];
        for (let i = index + 1; i < tokens.length; i++) {
          const next = tokens[i];
          const close = CLOSERS[next.type];
          if (close) {
            expected.push(close);
          } else if (expected.length === 0 && (next.type === 'semicolon' || next.type === '}')) {
            importEnd = next.type === 'semicolon' ? next.end : next.start;
            break;
          } else if (next.type === expected[expected.length - 1]) {
            expected.pop();
            if (expected.length === 0 && next.type === '}') {
              importEnd = next.end;
              break;
            }
          }
        }
        cuts.push({ start: token.start, end: importEnd, text: '/**/' });
      } else if (token.type === 'bad-url' || (token.type === 'url' && !isKeptUrl(token.value))) {
        cuts.push({ start: token.start, end: token.end, text: 'none' });
      } else if (token.type === 'string' && top?.imageSet && top.kind !== 'url') {
        const allowedType = top.kind === 'type' && IMAGE_MIME.test(token.value);
        if (!allowedType && !isKeptUrl(token.value)) badImageSets.add(top.imageSet);
      }
    },
  });
  return applyCuts(css, cuts);
}

export function inspectSvg(text: string): { errors: string[]; warnings: string[] } {
  const errors = new Set<string>();
  const warnings = new Set<string>();
  const flat = text
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<!\[CDATA\[|\]\]>/gi, '')
    .replace(/<[^<>]*>/g, '');

  const each = (pattern: RegExp, source: string, onHit: (hit: RegExpExecArray) => void) => {
    pattern.lastIndex = 0;
    for (let hit = pattern.exec(source); hit; hit = pattern.exec(source)) onHit(hit);
  };
  const linkTarget = (source: string) => (hit: RegExpExecArray) => {
    const target = excerpt(source, hit.index + hit[0].length);
    if (!SVG_SAFE_TARGET.test(target)) errors.add(`external link ${hit[1] ?? 'url'} ${target}`);
  };

  if (firstControl(text) >= 0) errors.add('control character');
  each(SVG_ELEMENT, text, (hit) => errors.add(`<${hit[1]}> is not allowed`));
  each(SVG_DECLARATION, text, (hit) => errors.add(`${hit[0]} is not allowed`));
  each(SVG_ENTITY, text, (hit) => errors.add(`entity ${excerpt(text, hit.index).slice(0, 8)}`));
  each(SVG_BACKSLASH, text, () => errors.add('backslash'));
  each(SVG_HANDLER, text, (hit) => errors.add(`${hit[1]} handler`));
  each(SVG_BANNED_ATTR, text, (hit) => errors.add(`${hit[1]} is not allowed`));
  each(SVG_NAMESPACE, text, (hit) => {
    if (!SVG_NAMESPACES.includes(hit[2])) errors.add(`namespace ${excerpt(hit[2], 0)}`);
  });
  each(SVG_LINK, text, linkTarget(text));
  each(SVG_ANIMATED_LINK, text, (hit) => errors.add(`animated link ${hit[0]}`));
  each(SVG_ENCODING, text, (hit) => {
    if (hit[1].toLowerCase() !== 'utf-8') errors.add(`encoding ${hit[1]}`);
  });
  each(SVG_NESTED, text, () => errors.add('nested svg'));
  each(SVG_RASTER, text, (hit) => {
    const problem = rasterProblem(hit[2], /;base64$/i.test(hit[1]));
    if (problem) errors.add(`embedded ${problem}`);
  });
  for (const source of [text, flat]) {
    each(SVG_IMPORT, source, () => errors.add('@import'));
    each(SVG_URL, source, linkTarget(source));
    each(SVG_FUNCTION, source, (hit) => errors.add(`${hit[1]}() is not allowed`));
  }
  each(SVG_TEXT, text, () => warnings.add('text element'));
  return { errors: [...errors], warnings: [...warnings] };
}
