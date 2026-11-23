import { type CSSProperties, useEffect, useRef, useState } from 'react';
import type { Rgb } from '../../../../lib/cover-palette';
import { SceneCanvas } from './SceneCanvas';
import { extractScenePalette, type ScenePalette } from './scene-palette';
import { useSceneMotion } from './use-scene-motion';

const css = (color: Rgb) => `rgb(${color.join(' ')})`;

function useScenePalette(artwork: string | null): ScenePalette | null {
  const [sampled, setSampled] = useState<{ url: string; palette: ScenePalette } | null>(null);
  useEffect(() => {
    if (!artwork) return;
    let alive = true;
    void extractScenePalette(artwork).then((palette) => {
      if (alive) setSampled(palette ? { url: artwork, palette } : null);
    });
    return () => {
      alive = false;
    };
  }, [artwork]);
  return sampled?.url === artwork ? sampled.palette : null;
}

function wash(palette: ScenePalette | null): CSSProperties {
  if (!palette) return {};
  const [, primary, secondary] = palette.colors;
  return { '--scene-a': css(primary), '--scene-b': css(secondary) } as CSSProperties;
}

export function SceneBackground({
  artwork,
  playing,
}: {
  artwork: string | null;
  playing: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const palette = useScenePalette(artwork);
  const { live, running } = useSceneMotion(rootRef, playing);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-ui="deck-scene"
      data-live={live && palette ? 'true' : 'false'}
      className="deck-scene"
      style={wash(palette)}
    >
      <div className="deck-scene-wash" />
      {live && palette && <SceneCanvas colors={palette.colors} running={running} />}
    </div>
  );
}
