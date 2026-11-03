import { memo } from 'react';
import { art } from '../../../lib/formatters';
import { ListMusic } from '../../../lib/icons';

interface PlaylistMosaicProps {
  covers: string[];
  size: number;
  stacked?: boolean;
}

function Cover({ url }: { url: string }) {
  const src = art(url, 't200x200');
  if (!src) return <span className="h-full w-full bg-ink/[0.05]" />;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className="h-full w-full object-cover"
    />
  );
}

function Layer({ size, offset, alpha }: { size: number; offset: number; alpha: number }) {
  return (
    <span
      aria-hidden
      className="absolute rounded-[12px]"
      style={{
        width: size - offset * 2,
        height: size,
        left: offset,
        top: -offset,
        background: `rgb(var(--ink) / ${alpha})`,
        border: '0.5px solid var(--color-border-glass)',
      }}
    />
  );
}

export const PlaylistMosaic = memo(function PlaylistMosaic({
  covers,
  size,
  stacked = false,
}: PlaylistMosaicProps) {
  const tiles = covers.length >= 4 ? covers.slice(0, 4) : covers.slice(0, 1);
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size, marginTop: stacked ? 6 : 0 }}
    >
      {stacked && <Layer size={size} offset={7} alpha={0.04} />}
      {stacked && <Layer size={size} offset={3.5} alpha={0.08} />}
      <div
        className={`relative grid h-full w-full overflow-hidden rounded-[12px] ${
          tiles.length === 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1'
        }`}
        style={{ boxShadow: '0 8px 20px rgba(0,0,0,0.4), inset 0 0 0 0.5px rgba(255,255,255,0.1)' }}
      >
        {tiles.length > 0 ? (
          tiles.map((url, i) => <Cover key={`${url}-${i}`} url={url} />)
        ) : (
          <span className="flex items-center justify-center bg-ink/[0.05] text-ink-30">
            <ListMusic size={Math.round(size * 0.34)} />
          </span>
        )}
      </div>
    </div>
  );
});
