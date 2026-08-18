import { isWhitelistedAssetUrl, toImageCacheUrl, toScproxyUrl } from './asset-url';

type PatchedImage = HTMLImageElement & {
  __origSrc?: string;
  __proxyRetryStage?: number;
  __skipProxyOnce?: boolean;
};

// Per-source memo of the encoded cache URL — virtualized grids re-assign the same
// src on every render; encoding (URL/JSON/btoa/hashShard) is the render-hot cost.
// Bounded (FIFO) so a long session streaming through many covers can't leak.
const IMAGE_URL_MEMO_CAP = 4000;
const imageCacheUrlMemo = new Map<string, string>();

function cachedImageUrl(url: string): string {
    let encoded = imageCacheUrlMemo.get(url);
    if (encoded === undefined) {
        encoded = toImageCacheUrl(url);
        if (imageCacheUrlMemo.size >= IMAGE_URL_MEMO_CAP) {
            const oldest = imageCacheUrlMemo.keys().next().value;
            if (oldest !== undefined) imageCacheUrlMemo.delete(oldest);
        }
        imageCacheUrlMemo.set(url, encoded);
    }
    return encoded;
}

// Hook <img>.src — route through permanent image cache, store original URL
// to enable retry on error.
const imgSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
Object.defineProperty(HTMLImageElement.prototype, 'src', {
  set(url: string) {
    const img = this as PatchedImage;
    if (img.__skipProxyOnce) {
      img.__skipProxyOnce = false;
      imgSrcDesc.set!.call(this, url);
      return;
    }

    if (url?.startsWith('http') && !isWhitelistedAssetUrl(url)) {
      img.__origSrc = url;
      img.__proxyRetryStage = 0;
        url = cachedImageUrl(url);
    }
    imgSrcDesc.set!.call(this, url);
  },
  get() {
    return imgSrcDesc.get!.call(this);
  },
});

// Global: hide broken images (proxy error, CDN blocked, etc.)
document.addEventListener(
  'error',
  (e) => {
    if (e.target instanceof HTMLImageElement) {
      const img = e.target as PatchedImage;
      const originalUrl = img.__origSrc;
      const retryStage = img.__proxyRetryStage ?? 0;

      if (originalUrl && retryStage === 0) {
        img.__proxyRetryStage = 1;
        img.style.removeProperty('display');
        imgSrcDesc.set!.call(img, toImageCacheUrl(originalUrl, { bypassCache: true }));
        return;
      }

      if (originalUrl && retryStage === 1) {
        img.__proxyRetryStage = 2;
        img.__skipProxyOnce = true;
        img.style.removeProperty('display');
        imgSrcDesc.set!.call(img, originalUrl);
        return;
      }

      img.style.display = 'none';
    }
  },
  true,
);

// Hook fetch()
const DEFAULT_SC_FETCH_TIMEOUT_MS = 12_000;
const origFetch = window.fetch.bind(window);
window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const existingSignal = init?.signal;
  const controller = existingSignal ? null : new AbortController();
  const signal = existingSignal ?? controller?.signal;
  const timeout = controller ? setTimeout(() => controller.abort(), DEFAULT_SC_FETCH_TIMEOUT_MS) : null;

  if (typeof input === 'string' && input.startsWith('http') && !isWhitelistedAssetUrl(input)) {
    input = toScproxyUrl(input);
  } else if (
    input instanceof Request &&
    input.url.startsWith('http') &&
    !isWhitelistedAssetUrl(input.url)
    ) {
    input = new Request(toScproxyUrl(input.url), input);
  }

  const timedInit: RequestInit = {
    ...(init ?? {}),
    signal,
  };

  return origFetch(input, timedInit).finally(() => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  });
}) as typeof fetch;
