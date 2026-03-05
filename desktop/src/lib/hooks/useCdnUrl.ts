import { useEffect, useState } from 'react';
import { isCdnBlocked, markCdnBlocked, proxiedUrl } from '../cdn.ts';

function isSndcdnHost(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.sndcdn.com');
  } catch {
    return false;
  }
}

export function useCdnUrl(url: string | null | undefined): string | null {
  const [useProxy, setUseProxy] = useState(() => isCdnBlocked());

  useEffect(() => {
    if (useProxy || !url || !isSndcdnHost(url)) return;

    const img = new Image();
    img.onerror = () => {
      markCdnBlocked();
      setUseProxy(true);
    };
    img.src = url;
  }, [url, useProxy]);

  if (!url) return null;
  if (useProxy && isSndcdnHost(url)) {
    return proxiedUrl(url);
  }
  return url;
}
