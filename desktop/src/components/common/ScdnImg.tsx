import { useCallback, useRef, useState } from 'react';
import { isCdnBlocked, markCdnBlocked } from '../../lib/cdn';
import { API_BASE } from '../../lib/constants';

type ScdnImgProps = React.ImgHTMLAttributes<HTMLImageElement>;

function isSndcdnHost(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith('.sndcdn.com');
  } catch {
    return false;
  }
}

export function ScdnImg({ src, onError, ...props }: ScdnImgProps) {
  const [useProxy, setUseProxy] = useState(() => isCdnBlocked());
  const failed = useRef(false);

  const sndcdn = isSndcdnHost(src);

  const actualSrc =
    useProxy && sndcdn ? `${API_BASE}/proxy/cdn?url=${encodeURIComponent(src!)}` : src;

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (failed.current) return;
      if (!useProxy && sndcdn) {
        markCdnBlocked();
        setUseProxy(true);
        return;
      }
      failed.current = true;
      onError?.(e);
    },
    [sndcdn, useProxy, onError],
  );

  return <img src={actualSrc ?? undefined} onError={handleError} {...props} />;
}
