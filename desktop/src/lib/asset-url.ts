import { getProxyPort } from './constants';

const WHITELIST = [
  'localhost',
  '127.0.0.1',
  'tauri.localhost',
  'scproxy.localhost',
  'images.soundcloud.su',
  'api.soundcloud.su',
  'images.scdinternal.site',
  'api.scdinternal.site',
  'unpkg.com',
];
const RETRY_BYPASS_CACHE_PARAM = '__scproxy_bust';
const LOCAL_PROXY_SHARDS = 20;

function withCacheBust(url: string): string {
  try {
    const next = new URL(url);
    next.searchParams.set(RETRY_BYPASS_CACHE_PARAM, `${Date.now()}`);
    return next.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${RETRY_BYPASS_CACHE_PARAM}=${Date.now()}`;
  }
}

function hashShard(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  }
  return hash % LOCAL_PROXY_SHARDS;
}

export function isWhitelistedAssetUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return WHITELIST.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return true;
  }
}

export function toScproxyUrl(url: string, { bypassCache = false } = {}): string {
  const target = bypassCache ? withCacheBust(url) : url;
  const encodedPath = encodeURIComponent(btoa(target));
  const proxyPort = getProxyPort();

  // В dev режиме используем HTTP для hot reload совместимости
  // В production используем scproxy:// протокол (обходит ATS на macOS)
  const isDev = import.meta.env.DEV;

  if (isDev && proxyPort) {
    const shard = hashShard(target);
    return `http://scproxy-${shard}.localhost:${proxyPort}/p/${encodedPath}`;
  }

  return `scproxy://localhost/${encodedPath}`;
}

export function proxiedAssetUrl(
  url: string | null | undefined,
  { bypassCache = false } = {},
): string | null {
  if (!url) return null;
  if (!url.startsWith('http') || isWhitelistedAssetUrl(url)) return url;

  return toScproxyUrl(url, { bypassCache });
}
