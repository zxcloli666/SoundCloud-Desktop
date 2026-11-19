import { useEffect, useState } from 'react';
import { type MomentWindow, momentWindow, trackMoment } from '../../lib/moment';
import type { Track } from '../../stores/player';

export function useMomentWindow(track: Track | undefined): MomentWindow | null {
  const [derived, setDerived] = useState<{ urn: string; window: MomentWindow } | null>(null);
  const known = track ? trackMoment(track) : null;

  useEffect(() => {
    if (!track || trackMoment(track)) return;
    let alive = true;
    void momentWindow(track).then((window) => {
      if (alive) setDerived({ urn: track.urn, window });
    });
    return () => {
      alive = false;
    };
  }, [track]);

  if (known) return known;
  return derived && derived.urn === track?.urn ? derived.window : null;
}
