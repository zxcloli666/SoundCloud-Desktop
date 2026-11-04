import { type CSSProperties, memo, useState } from 'react';

function hue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export const ArtImage = memo(function ArtImage({
  src,
  seed,
  className,
  style,
}: {
  src: string | null;
  seed: string;
  className: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    const h = hue(seed);
    return (
      <span
        aria-hidden
        className={`block ${className}`}
        style={{
          ...style,
          background: `linear-gradient(135deg, hsl(${h} 62% 58%), hsl(${(h + 48) % 360} 58% 38%))`,
        }}
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(src)}
      className={className}
      style={style}
    />
  );
});
