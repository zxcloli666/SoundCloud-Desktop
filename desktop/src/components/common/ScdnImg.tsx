import { useCallback, useRef, useState } from 'react';
import { isCdnBlocked, isSndcdnHost, markCdnBlocked } from '../../lib/cdn.ts';
import { API_BASE } from '../../lib/constants.ts';

type ScdnImgProps = React.ImgHTMLAttributes<HTMLImageElement>;

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
