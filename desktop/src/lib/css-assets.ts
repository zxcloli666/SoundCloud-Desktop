import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readDir, remove, writeFile } from '@tauri-apps/plugin-fs';
import { getStaticPort } from './constants';

const ASSETS_DIR = 'css-assets';
export const CSS_ASSET_PREFIX = 'sc-assets/';
export const CSS_ASSET_MAX_BYTES = 10 * 1024 * 1024;
export const CSS_ASSET_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.svg,.avif';
const ASSET_URL = /url\(\s*(['"]?)sc-assets\/([^'")\s]+)\1\s*\)/gi;

export type CssAssetResult = 'ok' | 'type' | 'size' | 'failed';

async function assetsDir(): Promise<string> {
  const dir = await join(await appDataDir(), ASSETS_DIR);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function cssAssetSnippet(name: string): string {
  return `url("${CSS_ASSET_PREFIX}${name}")`;
}

export function cssAssetHttpUrl(name: string): string | null {
  const port = getStaticPort();
  return port ? `http://127.0.0.1:${port}/${ASSETS_DIR}/${encodeURIComponent(name)}` : null;
}

export function resolveCssAssets(css: string): string {
  return css.replace(ASSET_URL, (match, _quote: string, name: string) => {
    const url = cssAssetHttpUrl(name);
    return url ? `url("${url}")` : match;
  });
}

export async function listCssAssets(): Promise<string[]> {
  const entries = await readDir(await assetsDir()).catch(() => []);
  return entries
    .filter((entry) => entry.isFile && entry.name)
    .map((entry) => entry.name)
    .sort();
}

function safeName(fileName: string): { base: string; ext: string } | null {
  const dot = fileName.lastIndexOf('.');
  const ext = dot > 0 ? fileName.slice(dot).toLowerCase() : '';
  if (!CSS_ASSET_ACCEPT.split(',').includes(ext)) return null;
  const base = fileName
    .slice(0, dot)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return { base: base || 'image', ext };
}

export async function addCssAsset(file: File): Promise<{ result: CssAssetResult; name?: string }> {
  const parts = safeName(file.name);
  if (!parts) return { result: 'type' };
  if (file.size > CSS_ASSET_MAX_BYTES) return { result: 'size' };
  try {
    const dir = await assetsDir();
    let name = `${parts.base}${parts.ext}`;
    for (let n = 2; await exists(await join(dir, name)); n++) name = `${parts.base}-${n}${parts.ext}`;
    await writeFile(await join(dir, name), new Uint8Array(await file.arrayBuffer()));
    return { result: 'ok', name };
  } catch {
    return { result: 'failed' };
  }
}

export async function removeCssAsset(name: string): Promise<void> {
  await remove(await join(await assetsDir(), name)).catch(() => undefined);
}
