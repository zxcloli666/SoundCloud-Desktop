import {
  compareVersions,
  GIT_REV,
  GITHUB_LOGIN,
  HEX_COLOR,
  isCleanText,
  isThemePath,
  SEMVER,
  SHA256,
  TEXT_LIMITS,
  THEME_FONTS,
  THEME_ID,
  THEME_LANGS,
  THEME_LICENSES,
  THEME_LIMITS,
  THEME_PREVIEW_PATHS,
  THEME_RESERVED_IDS,
  THEME_SCHEMES,
  type ThemeFont,
  type ThemeScheme,
} from './rules.ts';

export interface ThemeFile {
  path: string;
  sha256: string;
  size: number;
}

export interface ThemePreview extends ThemeFile {
  width: number;
  height: number;
}

export interface CatalogTheme {
  id: string;
  rev: string;
  name: string;
  description: Record<string, string>;
  version: string;
  author: { name: string; github?: string };
  license: string;
  minApp?: string;
  accent?: string;
  background?: string;
  font?: ThemeFont;
  scheme?: ThemeScheme;
  updated: string;
  hash: string;
  size: number;
  preview: ThemePreview;
  css: ThemeFile;
  assets: ThemeFile[];
  compatible: boolean;
}

export interface RevokedTheme {
  id: string;
  hash: string;
}

export interface Catalog {
  generated: string;
  rev: string;
  themes: CatalogTheme[];
  revoked: RevokedTheme[];
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

function isSize(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

function optional(value: unknown, check: (value: unknown) => boolean): boolean {
  return value === undefined || check(value);
}

function parseFile(raw: unknown, max: number, pathOk: (path: string) => boolean): ThemeFile | null {
  if (!isObject(raw) || typeof raw.path !== 'string' || !pathOk(raw.path)) return null;
  if (!matches(raw.sha256, SHA256) || !isSize(raw.size, max)) return null;
  return { path: raw.path, sha256: raw.sha256, size: raw.size };
}

function parsePreview(raw: unknown): ThemePreview | null {
  const file = parseFile(raw, THEME_LIMITS.previewBytes, (path) =>
    oneOf(THEME_PREVIEW_PATHS, path),
  );
  if (!file || !isObject(raw)) return null;
  const { width, height } = raw;
  const max = THEME_LIMITS.previewMaxWidth;
  if (!isSize(width, max) || !isSize(height, max) || width === 0 || height === 0) return null;
  return { ...file, width, height };
}

function parseAssets(raw: unknown): ThemeFile[] | null {
  if (!Array.isArray(raw) || raw.length > THEME_LIMITS.assetsCount) return null;
  const assets: ThemeFile[] = [];
  for (const item of raw) {
    const file = parseFile(
      item,
      THEME_LIMITS.assetBytes,
      (path) => path.startsWith('assets/') && isThemePath(path),
    );
    if (!file || assets.some((asset) => asset.path === file.path)) return null;
    assets.push(file);
  }
  const total = assets.reduce((sum, asset) => sum + asset.size, 0);
  return total <= THEME_LIMITS.assetsTotalBytes ? assets : null;
}

function parseDescription(raw: unknown): Record<string, string> | null {
  if (!isObject(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length < 1 || entries.length > THEME_LANGS.length) return null;
  const valid = entries.every(
    ([lang, text]) =>
      oneOf(THEME_LANGS, lang) &&
      typeof text === 'string' &&
      isCleanText(text, TEXT_LIMITS.description),
  );
  return valid ? (raw as Record<string, string>) : null;
}

function parseAuthor(raw: unknown): CatalogTheme['author'] | null {
  if (!isObject(raw) || typeof raw.name !== 'string') return null;
  if (!isCleanText(raw.name, TEXT_LIMITS.authorName)) return null;
  if (!optional(raw.github, (login) => matches(login, GITHUB_LOGIN))) return null;
  return raw.github === undefined
    ? { name: raw.name }
    : { name: raw.name, github: raw.github as string };
}

function isThemeId(value: unknown): value is string {
  return matches(value, THEME_ID) && !oneOf(THEME_RESERVED_IDS, value);
}

function parseEntry(raw: unknown, appVersion: string): CatalogTheme | null {
  if (!isObject(raw)) return null;
  const { id, rev, name, version, license, minApp, accent, background, font, scheme } = raw;
  if (!isThemeId(id) || !matches(rev, GIT_REV) || !matches(version, SEMVER)) return null;
  if (typeof name !== 'string' || !isCleanText(name, TEXT_LIMITS.name)) return null;
  if (!oneOf(THEME_LICENSES, license) || !matches(raw.hash, SHA256)) return null;
  if (typeof raw.updated !== 'string') return null;
  if (!optional(minApp, (value) => matches(value, SEMVER))) return null;
  if (!optional(accent, (value) => matches(value, HEX_COLOR))) return null;
  if (!optional(background, (value) => matches(value, HEX_COLOR))) return null;
  if (!optional(font, (value) => oneOf(THEME_FONTS, value))) return null;
  if (!optional(scheme, (value) => oneOf(THEME_SCHEMES, value))) return null;

  const description = parseDescription(raw.description);
  const author = parseAuthor(raw.author);
  const preview = parsePreview(raw.preview);
  const css = parseFile(raw.css, THEME_LIMITS.cssBytes, (path) => path === 'theme.css');
  const assets = parseAssets(raw.assets);
  if (!description || !author || !preview || !css || !assets) return null;
  const size = css.size + assets.reduce((sum, asset) => sum + asset.size, 0);
  if (raw.size !== size) return null;

  const minAppVersion = minApp as string | undefined;
  return {
    id,
    rev,
    name,
    description,
    version,
    author,
    license,
    minApp: minAppVersion,
    accent: accent as string | undefined,
    background: background as string | undefined,
    font: font as ThemeFont | undefined,
    scheme: scheme as ThemeScheme | undefined,
    updated: raw.updated,
    hash: raw.hash,
    size,
    preview,
    css,
    assets,
    compatible:
      !minAppVersion ||
      (SEMVER.test(appVersion) && compareVersions(appVersion, minAppVersion) >= 0),
  };
}

function parseRevoked(raw: unknown): RevokedTheme[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is Json => isObject(item) && isThemeId(item.id) && matches(item.hash, SHA256),
    )
    .map((item) => ({ id: item.id as string, hash: item.hash as string }));
}

export function parseIndex(json: unknown, appVersion: string): Catalog | null {
  if (!isObject(json) || json.schema !== 1 || !matches(json.rev, GIT_REV)) return null;
  if (typeof json.generated !== 'string' || !Array.isArray(json.themes)) return null;
  const revoked = parseRevoked(json.revoked);
  const themes: CatalogTheme[] = [];
  for (const raw of json.themes) {
    const theme = parseEntry(raw, appVersion);
    if (!theme || themes.some((known) => known.id === theme.id)) continue;
    if (revoked.some((item) => item.id === theme.id && item.hash === theme.hash)) continue;
    themes.push(theme);
  }
  return { generated: json.generated, rev: json.rev, themes, revoked };
}

export function indexUrl(base: string): string {
  return `${base}/refs/heads/themes-dist/v1/index.json`;
}

export function fileUrl(base: string, rev: string, id: string, path: string): string {
  return `${base}/${rev}/themes/${id}/${path}`;
}

export function localName(file: ThemeFile): string {
  return `${file.sha256}.${file.path.slice(file.path.lastIndexOf('.') + 1).toLowerCase()}`;
}

export function pickDescription(description: Record<string, string>, lang: string): string {
  const short = lang.slice(0, 2).toLowerCase();
  return (
    description[short] ?? description.en ?? description.ru ?? Object.values(description)[0] ?? ''
  );
}
