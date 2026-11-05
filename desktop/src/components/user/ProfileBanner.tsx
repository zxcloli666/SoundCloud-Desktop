import { memo, useState } from 'react';
import { proxiedAssetUrl } from '../../lib/asset-url';
import { usePerfMode } from '../../lib/perf';

const FADE = 'linear-gradient(to bottom, #000 0%, #000 40%, transparent 90%)';

function bannerSrc(url: string) {
  return proxiedAssetUrl(url.replace(/-original\.(\w+)$/, '-t2480x520.$1'));
}

function ProfileBannerImpl({ url, hasStar }: { url: string; hasStar: boolean }) {
  const perf = usePerfMode();
  const glow = perf.blur(60);
  const [state, setState] = useState<'loading' | 'shown' | 'failed'>('loading');
  const src = bannerSrc(url);
  if (!src || state === 'failed') return null;
  const shown = state === 'shown';
  return (
    <>
      {glow > 0 && (
        <div
          data-ui="user-banner-glow"
          className="absolute inset-0 -z-10 overflow-hidden rounded-[2.5rem] pointer-events-none"
        >
          <img
            src={src}
            alt=""
            aria-hidden
            draggable={false}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            style={{
              opacity: shown ? (hasStar ? 0.2 : 0.35) : 0,
              filter: `blur(${glow}px) saturate(160%)`,
              transform: 'scale(1.3)',
            }}
          />
        </div>
      )}
      <div
        data-ui="user-banner"
        className="relative w-full aspect-[2480/520] max-h-[280px] -mb-12 @lg:-mb-16 overflow-hidden rounded-t-[2.5rem] pointer-events-none"
      >
        <img
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => setState('shown')}
          onError={() => setState('failed')}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{
            opacity: shown ? 1 : 0,
            maskImage: FADE,
            WebkitMaskImage: FADE,
          }}
        />
      </div>
    </>
  );
}

export const ProfileBanner = memo(ProfileBannerImpl);
