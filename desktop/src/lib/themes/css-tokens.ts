export type TokenType =
  | 'ident'
  | 'function'
  | 'at-keyword'
  | 'hash'
  | 'string'
  | 'bad-string'
  | 'url'
  | 'bad-url'
  | 'delim'
  | 'number'
  | 'percentage'
  | 'dimension'
  | 'unicode-range'
  | 'whitespace'
  | 'cdo'
  | 'cdc'
  | 'colon'
  | 'semicolon'
  | 'comma'
  | '('
  | ')'
  | '['
  | ']'
  | '{'
  | '}';

export interface Position {
  line: number;
  column: number;
}

export interface Token extends Position {
  type: TokenType;
  start: number;
  end: number;
  value: string;
}

interface Problem {
  offset: number;
  message: string;
}

export interface Scan {
  tokens: Token[];
  problems: Problem[];
  locate: (offset: number) => Position;
}

const EOF = -1;

const PUNCTUATION: Record<number, TokenType> = {
  40: '(',
  41: ')',
  44: 'comma',
  58: 'colon',
  59: 'semicolon',
  91: '[',
  93: ']',
  123: '{',
  125: '}',
};

function isNewline(c: number): boolean {
  return c === 10 || c === 13 || c === 12;
}

function isWhitespace(c: number): boolean {
  return c === 32 || c === 9 || isNewline(c);
}

function isDigit(c: number): boolean {
  return c >= 48 && c <= 57;
}

function isHex(c: number): boolean {
  return isDigit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
}

function isNameStart(c: number): boolean {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c >= 0x80;
}

function isNameChar(c: number): boolean {
  return isNameStart(c) || isDigit(c) || c === 45;
}

function isNonPrintable(c: number): boolean {
  return (c >= 0 && c <= 8) || c === 11 || (c >= 14 && c <= 31) || c === 127;
}

export function asciiLower(text: string): string {
  return text.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 13 && text.charCodeAt(i + 1) === 10) i++;
    if (isNewline(c)) starts.push(i + 1);
  }
  return starts;
}

export function tokenize(css: string): Scan {
  const lines = lineStarts(css);
  const tokens: Token[] = [];
  const problems: Problem[] = [];
  let pos = 0;

  const locate = (offset: number): Position => {
    let low = 0;
    let high = lines.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (lines[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return { line: low + 1, column: offset - lines[low] + 1 };
  };

  const at = (i: number): number => {
    if (i >= css.length) return EOF;
    const c = css.charCodeAt(i);
    return c === 0 ? 0xfffd : c;
  };

  const newlineLength = (i: number): number => {
    if (at(i) === 13 && at(i + 1) === 10) return 2;
    return isNewline(at(i)) ? 1 : 0;
  };

  const isEscape = (i: number): boolean => at(i) === 92 && !isNewline(at(i + 1));

  const startsIdent = (i: number): boolean => {
    const c = at(i);
    if (c === 45) return isNameStart(at(i + 1)) || at(i + 1) === 45 || isEscape(i + 1);
    return isNameStart(c) || isEscape(i);
  };

  const startsNumber = (i: number): boolean => {
    const c = at(i);
    if (c === 43 || c === 45) {
      return isDigit(at(i + 1)) || (at(i + 1) === 46 && isDigit(at(i + 2)));
    }
    if (c === 46) return isDigit(at(i + 1));
    return isDigit(c);
  };

  const push = (type: TokenType, start: number, value: string) => {
    tokens.push({ type, start, end: pos, value, ...locate(start) });
  };

  const problem = (offset: number, message: string) => {
    problems.push({ offset, message });
  };

  const consumeEscape = (): string => {
    const c = at(pos);
    if (c === EOF) {
      problem(pos - 1, 'backslash at end of file');
      return '\uFFFD';
    }
    if (!isHex(c)) {
      pos++;
      return String.fromCharCode(c);
    }
    const start = pos;
    while (pos - start < 6 && isHex(at(pos))) pos++;
    const code = Number.parseInt(css.slice(start, pos), 16);
    if (isWhitespace(at(pos))) pos += newlineLength(pos) || 1;
    if (code === 0 || (code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff) return '\uFFFD';
    return String.fromCodePoint(code);
  };

  const consumeName = (): string => {
    let name = '';
    for (;;) {
      const c = at(pos);
      if (isNameChar(c)) {
        name += String.fromCharCode(c);
        pos++;
      } else if (isEscape(pos)) {
        pos++;
        name += consumeEscape();
      } else {
        return name;
      }
    }
  };

  const consumeNumeric = (start: number) => {
    if (at(pos) === 43 || at(pos) === 45) pos++;
    while (isDigit(at(pos))) pos++;
    if (at(pos) === 46 && isDigit(at(pos + 1))) {
      pos += 2;
      while (isDigit(at(pos))) pos++;
    }
    const e = at(pos);
    if (e === 69 || e === 101) {
      const sign = at(pos + 1) === 43 || at(pos + 1) === 45 ? 1 : 0;
      if (isDigit(at(pos + 1 + sign))) {
        pos += 2 + sign;
        while (isDigit(at(pos))) pos++;
      }
    }
    if (startsIdent(pos)) push('dimension', start, consumeName());
    else if (at(pos) === 37) {
      pos++;
      push('percentage', start, css.slice(start, pos));
    } else push('number', start, css.slice(start, pos));
  };

  const consumeUnicodeRange = (start: number) => {
    let count = 0;
    while (count < 6 && isHex(at(pos))) {
      pos++;
      count++;
    }
    let wildcard = false;
    while (count < 6 && at(pos) === 63) {
      pos++;
      count++;
      wildcard = true;
    }
    if (!wildcard && at(pos) === 45 && isHex(at(pos + 1))) {
      pos++;
      count = 0;
      while (count < 6 && isHex(at(pos))) {
        pos++;
        count++;
      }
    }
    push('unicode-range', start, css.slice(start, pos));
  };

  const consumeBadUrl = (start: number) => {
    problem(start, 'bad url');
    for (;;) {
      const c = at(pos);
      if (c === EOF) break;
      if (c === 41) {
        pos++;
        break;
      }
      if (isEscape(pos)) {
        pos++;
        consumeEscape();
      } else pos++;
    }
    push('bad-url', start, '');
  };

  const consumeUrl = (start: number) => {
    let value = '';
    while (isWhitespace(at(pos))) pos++;
    for (;;) {
      const c = at(pos);
      if (c === 41) {
        pos++;
        return push('url', start, value);
      }
      if (c === EOF) {
        problem(start, 'unterminated url');
        return push('url', start, value);
      }
      if (isWhitespace(c)) {
        while (isWhitespace(at(pos))) pos++;
        if (at(pos) === 41 || at(pos) === EOF) continue;
        return consumeBadUrl(start);
      }
      if (c === 34 || c === 39 || c === 40 || isNonPrintable(c)) return consumeBadUrl(start);
      if (c === 92) {
        if (!isEscape(pos)) return consumeBadUrl(start);
        pos++;
        value += consumeEscape();
      } else {
        value += String.fromCharCode(c);
        pos++;
      }
    }
  };

  const consumeIdentLike = (start: number) => {
    const name = consumeName();
    if (at(pos) !== 40) return push('ident', start, name);
    pos++;
    if (asciiLower(name) !== 'url') return push('function', start, name);
    while (isWhitespace(at(pos)) && isWhitespace(at(pos + 1))) pos++;
    const c = at(pos);
    const next = isWhitespace(c) ? at(pos + 1) : c;
    if (next === 34 || next === 39) return push('function', start, name);
    consumeUrl(start);
  };

  const consumeString = (quote: number, start: number) => {
    let value = '';
    for (;;) {
      const c = at(pos);
      if (c === quote) {
        pos++;
        return push('string', start, value);
      }
      if (c === EOF) {
        problem(start, 'unterminated string');
        return push('string', start, value);
      }
      if (isNewline(c)) {
        problem(start, 'newline in string');
        return push('bad-string', start, value);
      }
      if (c === 92 && at(pos + 1) === EOF) pos++;
      else if (c === 92 && isNewline(at(pos + 1))) pos += 1 + newlineLength(pos + 1);
      else if (c === 92) {
        pos++;
        value += consumeEscape();
      } else {
        value += String.fromCharCode(c);
        pos++;
      }
    }
  };

  const skipComments = () => {
    while (at(pos) === 47 && at(pos + 1) === 42) {
      const end = css.indexOf('*/', pos + 2);
      if (end < 0) {
        problem(pos, 'unterminated comment');
        pos = css.length;
        return;
      }
      pos = end + 2;
    }
  };

  for (;;) {
    skipComments();
    if (pos >= css.length) break;
    const start = pos;
    const c = at(pos);
    if (isWhitespace(c)) {
      while (isWhitespace(at(pos))) pos++;
      push('whitespace', start, ' ');
    } else if (c === 34 || c === 39) {
      pos++;
      consumeString(c, start);
    } else if (c === 35) {
      pos++;
      if (isNameChar(at(pos)) || isEscape(pos)) push('hash', start, consumeName());
      else push('delim', start, '#');
    } else if (PUNCTUATION[c]) {
      pos++;
      push(PUNCTUATION[c], start, String.fromCharCode(c));
    } else if (
      (c === 85 || c === 117) &&
      at(pos + 1) === 43 &&
      (isHex(at(pos + 2)) || at(pos + 2) === 63)
    ) {
      pos += 2;
      consumeUnicodeRange(start);
    } else if (startsNumber(pos)) {
      consumeNumeric(start);
    } else if (c === 45 && at(pos + 1) === 45 && at(pos + 2) === 62) {
      pos += 3;
      push('cdc', start, '-->');
    } else if (startsIdent(pos)) {
      consumeIdentLike(start);
    } else if (c === 60 && css.startsWith('!--', pos + 1)) {
      pos += 4;
      push('cdo', start, '<!--');
    } else if (c === 64 && startsIdent(pos + 1)) {
      pos++;
      push('at-keyword', start, consumeName());
    } else {
      if (c === 92) problem(start, 'backslash before a newline');
      pos++;
      push('delim', start, String.fromCharCode(c));
    }
  }

  return { tokens, problems, locate };
}
