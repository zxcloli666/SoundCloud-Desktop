import type React from 'react';
import type { Track } from '../stores/player';
import { useTrackPicked, useTrackSelection } from '../stores/trackSelection';

export function useRowPick(track: Track) {
  const picked = useTrackPicked(track.urn);
  const onClickCapture = (e: React.MouseEvent) => {
    const { picked: all, toggle } = useTrackSelection.getState();
    if (!e.metaKey && !e.ctrlKey && all.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    toggle(track);
  };
  return { 'data-picked': picked || undefined, onClickCapture };
}
