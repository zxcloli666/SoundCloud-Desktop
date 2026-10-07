import type { ReactNode } from 'react';
import { siLastdotfm } from 'simple-icons';
import { AudioLines } from '../../../../lib/icons';
import type { ScrobbleService } from '../../../../stores/scrobble';

interface Brand {
  name: string;
  color: string;
  glow: string;
  wash: string;
  mark: string;
  countKey: string;
}

export const BRANDS: Record<ScrobbleService, Brand> = {
  lastfm: {
    name: 'Last.fm',
    color: '#d51007',
    glow: 'rgba(213,16,7,0.32)',
    wash: 'rgba(213,16,7,0.13)',
    mark: 'linear-gradient(140deg, #ff3b30, #b90000)',
    countKey: 'settings.scrobblePlays',
  },
  listenbrainz: {
    name: 'ListenBrainz',
    color: '#eb743b',
    glow: 'rgba(235,116,59,0.28)',
    wash: 'rgba(235,116,59,0.12)',
    mark: 'linear-gradient(140deg, #eb743b, #353070)',
    countKey: 'settings.scrobbleListens',
  },
};

function Glyph({ service }: { service: ScrobbleService }): ReactNode {
  if (service === 'listenbrainz') return <AudioLines size={17} strokeWidth={2.4} />;
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
      <path d={siLastdotfm.path} />
    </svg>
  );
}

export function BrandMark({ service, size = 36 }: { service: ScrobbleService; size?: number }) {
  const brand = BRANDS[service];
  return (
    <div
      className="flex items-center justify-center shrink-0 rounded-xl text-white"
      style={{
        width: size,
        height: size,
        background: brand.mark,
        boxShadow: `0 6px 18px ${brand.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
      }}
    >
      <Glyph service={service} />
    </div>
  );
}
