import { listen } from '@tauri-apps/api/event';
import { create } from 'zustand';
import type { VideoHost } from './video-element';

const SHOW_AFTER_MS = 250;
const IDLE: VideoLoad = { host: null, share: null };

export interface VideoLoad {
  host: VideoHost | null;
  share: number | null;
}

interface Wait {
  url: string;
  share: number | null;
}

interface Progress {
  url: string;
  received: number;
  total: number | null;
}

export const useVideoLoad = create<VideoLoad>(() => IDLE);

let wait: Wait | null = null;
let listening = false;

export function beginVideoLoad(host: VideoHost, url: string): () => void {
  listenProgress();
  const mine: Wait = { url, share: null };
  wait = mine;
  const timer = window.setTimeout(
    () => useVideoLoad.setState({ host, share: mine.share }),
    SHOW_AFTER_MS,
  );
  return () => {
    window.clearTimeout(timer);
    if (wait !== mine) return;
    wait = null;
    useVideoLoad.setState(IDLE);
  };
}

function listenProgress() {
  if (listening) return;
  listening = true;
  void listen<Progress>('video:progress', ({ payload }) => {
    if (wait?.url !== payload.url) return;
    wait.share = payload.total ? Math.min(payload.received / payload.total, 1) : null;
    if (useVideoLoad.getState().host) useVideoLoad.setState({ share: wait.share });
  });
}
