import { setVideoOpaque, type VideoHost } from './video-element';
import { beginVideoLoad } from './video-load';

export const FADE_MS = 300;

export function hangCurtain(host: VideoHost, slot: HTMLElement) {
  let shown = false;
  let opaqueTimer = 0;
  let endLoad: (() => void) | null = beginVideoLoad(host);

  const show = (on: boolean) => {
    if (on === shown) return;
    shown = on;
    slot.style.transition = `opacity ${FADE_MS}ms ease-out`;
    slot.style.opacity = on ? '1' : '0';
    window.clearTimeout(opaqueTimer);
    if (on) opaqueTimer = window.setTimeout(() => setVideoOpaque(host, true), FADE_MS);
    else setVideoOpaque(host, false);
  };

  const want = (wanted: boolean, ready: boolean) => {
    show(wanted && ready);
    if (wanted && !ready) {
      endLoad ??= beginVideoLoad(host);
      return;
    }
    endLoad?.();
    endLoad = null;
  };

  const drop = () => {
    slot.style.transition = 'none';
    slot.style.opacity = '0';
  };

  const close = () => {
    window.clearTimeout(opaqueTimer);
    endLoad?.();
    drop();
    setVideoOpaque(host, false);
  };

  drop();
  return { want, close };
}
