import { toast } from 'sonner';
import i18n from '../i18n';
import { useSettingsStore } from '../stores/settings';

const PROBE_DELAY_MS = 5000;
const PROBE_DURATION_MS = 3000;
const SLOW_FRAME_MS = 40;
const SOFTWARE_RENDERER = /swiftshader|basic render|llvmpipe|softpipe/i;

function isSoftwareRendered(): boolean {
  const gl = document.createElement('canvas').getContext('webgl');
  if (!gl) return true;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return SOFTWARE_RENDERER.test(renderer);
}

function medianFrameMs(): Promise<number> {
  return new Promise((resolve) => {
    const frames: number[] = [];
    const start = performance.now();
    let last = start;
    const step = (now: number) => {
      frames.push(now - last);
      last = now;
      if (now - start < PROBE_DURATION_MS) {
        requestAnimationFrame(step);
        return;
      }
      frames.sort((a, b) => a - b);
      resolve(frames[Math.floor(frames.length / 2)]);
    };
    requestAnimationFrame(step);
  });
}

function stillOnDefault(): boolean {
  const { perfMode, perfModeUserSet } = useSettingsStore.getState();
  return perfMode === 'beauty' && !perfModeUserSet;
}

export function probePerfMode(): void {
  if (!stillOnDefault()) return;
  setTimeout(async () => {
    if (document.hidden || !document.hasFocus()) return;
    const weak = isSoftwareRendered() || (await medianFrameMs()) > SLOW_FRAME_MS;
    if (!weak || !stillOnDefault()) return;
    useSettingsStore.setState({ perfMode: 'light' });
    toast(i18n.t('settings.perfAutoLight'), {
      duration: 10000,
      action: {
        label: i18n.t('settings.perfAutoLightUndo'),
        onClick: () => useSettingsStore.getState().setPerfMode('beauty'),
      },
    });
  }, PROBE_DELAY_MS);
}
