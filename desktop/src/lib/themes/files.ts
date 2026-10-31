import { BaseDirectory, exists, readTextFile } from '@tauri-apps/plugin-fs';
import { THEMES_RAW_BASE } from '../constants';
import { trackedInvoke as invoke } from '../diagnostics';
import { inspectSvg, inspectThemeCss } from './css-guard.ts';
import { fetchBytes } from './fetch';
import { type CatalogTheme, fileUrl, localName, type ThemeFile } from './index-parse.ts';
import { sniffAssetType, THEME_LIMITS, type ThemeFont, type ThemeScheme } from './rules.ts';

export interface InstalledVersion {
  version: string;
  hash: string;
  rev: string;
  name: string;
  accent?: string;
  background?: string;
  font?: ThemeFont;
  scheme?: ThemeScheme;
  files: { css: string; assets: Record<string, string> };
}

export class ThemeCheckError extends Error {}

const FILES_DIR = 'themes/files';
const APP_DATA = { baseDir: BaseDirectory.AppData };
const CSS_PATH = 'theme.css';
const ASSET_PREFIX = 'assets/';

const pending = new Map<string, number>();
const cssCache = new Map<string, string>();

function filePath(name: string): string {
  return `${FILES_DIR}/${name}`;
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ThemeCheckError('not utf-8');
  }
}

async function storeFile(id: string, rev: string, file: ThemeFile, assetNames: string[]) {
  const name = localName(file);
  if (await exists(filePath(name), APP_DATA)) return;
  const url = fileUrl(THEMES_RAW_BASE, rev, id, file.path);
  const bytes = await fetchBytes(url, file.size, file.sha256);
  const ext = name.slice(name.indexOf('.') + 1);
  if (file.path === CSS_PATH) {
    const report = inspectThemeCss(decodeUtf8(bytes), assetNames);
    if (report.errors.length) throw new ThemeCheckError(report.errors[0].message);
  } else {
    const type = sniffAssetType(bytes);
    if (type !== (ext === 'jpg' ? 'jpeg' : ext)) {
      throw new ThemeCheckError(`${file.path}: wrong type`);
    }
    if (type === 'svg' && inspectSvg(decodeUtf8(bytes)).errors.length) {
      throw new ThemeCheckError(`${file.path}: unsafe svg`);
    }
  }
  await invoke('theme_file_store', bytes, undefined, {
    headers: { 'x-theme-sha256': file.sha256, 'x-theme-ext': ext },
  });
}

async function storeFiles(id: string, rev: string, files: ThemeFile[]) {
  const names = files.map(localName);
  const assetNames = files
    .filter((file) => file.path.startsWith(ASSET_PREFIX))
    .map((file) => file.path.slice(ASSET_PREFIX.length));
  for (const name of names) pending.set(name, (pending.get(name) ?? 0) + 1);
  try {
    await Promise.all(files.map((file) => storeFile(id, rev, file, assetNames)));
  } finally {
    for (const name of names) {
      const left = (pending.get(name) ?? 1) - 1;
      if (left > 0) pending.set(name, left);
      else pending.delete(name);
    }
  }
}

export async function downloadVersion(entry: CatalogTheme): Promise<InstalledVersion> {
  await storeFiles(entry.id, entry.rev, [entry.css, ...entry.assets]);
  return {
    version: entry.version,
    hash: entry.hash,
    rev: entry.rev,
    name: entry.name,
    accent: entry.accent,
    background: entry.background,
    font: entry.font,
    scheme: entry.scheme,
    files: {
      css: localName(entry.css),
      assets: Object.fromEntries(
        entry.assets.map((asset) => [asset.path.slice(ASSET_PREFIX.length), localName(asset)]),
      ),
    },
  };
}

export async function missingFiles(installed: InstalledVersion): Promise<boolean> {
  const found = await Promise.all(
    versionNames(installed).map((name) => exists(filePath(name), APP_DATA)),
  );
  return found.includes(false);
}

export async function repair(id: string, installed: InstalledVersion): Promise<void> {
  const css = {
    path: CSS_PATH,
    sha256: installed.files.css.slice(0, 64),
    size: THEME_LIMITS.cssBytes,
  };
  const assets = Object.entries(installed.files.assets).map(([name, local]) => ({
    path: `${ASSET_PREFIX}${name}`,
    sha256: local.slice(0, 64),
    size: THEME_LIMITS.assetBytes,
  }));
  await storeFiles(id, installed.rev, [css, ...assets]);
}

export async function readThemeCss(name: string): Promise<string> {
  const cached = cssCache.get(name);
  if (cached !== undefined) return cached;
  const css = await readTextFile(filePath(name), APP_DATA);
  cssCache.set(name, css);
  return css;
}

export function versionNames(installed: InstalledVersion): string[] {
  return [installed.files.css, ...Object.values(installed.files.assets)];
}

export async function collectGarbage(keep: string[]): Promise<void> {
  if (pending.size) return;
  await invoke<number>('theme_files_gc', { keep: [...new Set(keep)] }).catch(() => 0);
}
