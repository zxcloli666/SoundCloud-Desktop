import { isMac } from './platform';

const STYLE_ID = 'sc-custom-css';
const IMPORT_RULE = /@import\b[^;]*;?/gi;
const URL_TOKEN = /url\(\s*(['"]?)(.*?)\1\s*\)/gis;
const IMAGE_SET = /(?:-webkit-)?image-set\((?:[^()]|\([^()]*\))*\)/gi;
const LOCAL_SCHEME = /^(?:data:|blob:|asset:|https?:\/\/asset\.localhost\/)/i;

export interface SanitizedCss {
  css: string;
  blocked: number;
}

function isLocalUrl(target: string): boolean {
  const value = target.trim();
  if (LOCAL_SCHEME.test(value)) return true;
  return !value.includes(':') && !value.includes('\\') && !value.startsWith('//');
}

function hasRemoteString(chunk: string): boolean {
  const strings = chunk.match(/(['"])(.*?)\1/g) ?? [];
  return strings.some((quoted) => !isLocalUrl(quoted.slice(1, -1)));
}

export function sanitizeCustomCss(source: string): SanitizedCss {
  let blocked = 0;
  const block = (replacement: string) => {
    blocked += 1;
    return replacement;
  };
  const css = source
    .replace(IMPORT_RULE, () => block(''))
    .replace(URL_TOKEN, (match, _quote: string, target: string) =>
      isLocalUrl(target) ? match : block('none'),
    )
    .replace(IMAGE_SET, (match) => (hasRemoteString(match) ? block('none') : match));
  return { css, blocked };
}

export function effectiveCustomCss(state: { customCss: string; customCssEnabled: boolean }) {
  return state.customCssEnabled ? sanitizeCustomCss(state.customCss).css : '';
}

export function applyCustomCss(css: string, doc: Document = document) {
  const existing = doc.getElementById(STYLE_ID);
  if (!css.trim()) {
    existing?.remove();
    return;
  }
  const style = existing ?? Object.assign(doc.createElement('style'), { id: STYLE_ID });
  if (style.textContent !== css) style.textContent = css;
  if (doc.head.lastElementChild !== style) doc.head.appendChild(style);
}

export function isCustomCssHotkey(e: KeyboardEvent): boolean {
  if (e.code !== 'KeyC' || !e.shiftKey || !e.altKey || e.getModifierState('AltGraph')) return false;
  return isMac() ? e.metaKey : e.ctrlKey;
}

export function customCssHotkeyLabel(): string[] {
  return isMac() ? ['⌘', '⌥', '⇧', 'C'] : ['Ctrl', 'Alt', 'Shift', 'C'];
}
