import { create } from 'zustand';
import type { VideoHost } from './video-element';

const SHOW_AFTER_MS = 250;

export const useVideoLoad = create<{ host: VideoHost | null }>(() => ({ host: null }));

let current: object | null = null;

export function beginVideoLoad(host: VideoHost): () => void {
  const mine = {};
  current = mine;
  const show = () => useVideoLoad.setState({ host });
  const timer = window.setTimeout(show, useVideoLoad.getState().host ? 0 : SHOW_AFTER_MS);
  return () => {
    window.clearTimeout(timer);
    queueMicrotask(() => {
      if (current === mine) useVideoLoad.setState({ host: null });
    });
  };
}
