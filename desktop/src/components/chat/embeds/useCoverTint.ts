import { useEffect, useState } from 'react';
import { coverSrc, extractPalette, type Rgb, tintFromRgb } from '../../../lib/cover-palette';

export function useCoverTint(artworkUrl: string | null, enabled: boolean): Rgb | null {
  const src = enabled ? coverSrc(artworkUrl) : null;
  const [tint, setTint] = useState<Rgb | null>(null);

  useEffect(() => {
    if (!src) return;
    let alive = true;
    extractPalette(src).then((palette) => {
      if (alive && palette) setTint(tintFromRgb(palette.primary));
    });
    return () => {
      alive = false;
    };
  }, [src]);

  return src ? tint : null;
}
