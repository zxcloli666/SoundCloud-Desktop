import { useEffect, useState } from 'react';
import { isCdnBlocked, isSndcdnHost, markCdnBlocked, proxiedUrl } from './cdn.ts';

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
