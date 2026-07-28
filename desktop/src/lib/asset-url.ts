import { getProxyPort, IMAGES_BASE } from './constants';
import { isMac } from './platform';

const WHITELIST = [
  'localhost',
  '127.0.0.1',
  'tauri.localhost',
  'scproxy.localhost',
  'images.scnative.space',
  'api.scnative.space',
  'api-star.scnative.space',
  'stream.scnative.space',
  'stream-star.scnative.space',
  'storage.scnative.space',
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

function buildEncodedPayload(
  url: string,
  bypassCache: boolean,
  upstream: string = IMAGES_BASE,
): { encoded: string; target: string } {
  const target = bypassCache ? withCacheBust(url) : url;
  return {
    encoded: encodeURIComponent(btoa(JSON.stringify([target, upstream]))),
    target,
  };
}

/** `direct` makes the local proxy fetch the target itself with a browser
 *  User-Agent instead of relaying through the image CDN — needed for hosts that
 *  403 non-browser clients (Wallhaven, Konachan). */
export function toScproxyUrl(url: string, { bypassCache = false, direct = false } = {}): string {
  const { encoded, target } = buildEncodedPayload(
    url,
    bypassCache,
    direct ? 'direct' : IMAGES_BASE,
  );

  const proxyPort = getProxyPort();
  if (proxyPort && !isMac()) {
    const shard = hashShard(target);
    return `http://scproxy-${shard}.localhost:${proxyPort}/p/${encoded}`;
  }

  return `scproxy://localhost/${encoded}`;
}

/**
 * Permanent on-disk image cache endpoint.
 * Stored in app_data_dir/images/, never cleared by idle/maintenance —
 * only by an explicit user action.
 */
export function toImageCacheUrl(url: string, { bypassCache = false } = {}): string {
  const { encoded, target } = buildEncodedPayload(url, bypassCache);

  const proxyPort = getProxyPort();
  if (proxyPort && !isMac()) {
    const shard = hashShard(target);
    return `http://scproxy-${shard}.localhost:${proxyPort}/img/${encoded}`;
  }

  return `scproxy://localhost/img/${encoded}`;
}

export function proxiedAssetUrl(
  url: string | null | undefined,
  { bypassCache = false } = {},
): string | null {
  if (!url) return null;
  if (!url.startsWith('http') || isWhitelistedAssetUrl(url)) return url;

  const proxyPort = getProxyPort();
  if (!proxyPort) {
    return url;
  }

  return toImageCacheUrl(url, { bypassCache });
}
