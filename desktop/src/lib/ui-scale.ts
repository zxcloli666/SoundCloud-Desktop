import { toast } from 'sonner';
import i18n from '../i18n';
import { useSettingsStore } from '../stores/settings';

export const UI_SCALE_MIN = 80;
export const UI_SCALE_MAX = 130;
export const UI_SCALE_STEP = 10;
export const UI_SCALE_DEFAULT = 100;

const BASE_ZOOM_KEY = 'sc-base-zoom';
const WHEEL_NOTCH = 40;
const WHEEL_IDLE_MS = 220;

let baseZoom = 1;

export function clampUiScale(value: number) {
  const snapped = Math.round(value / UI_SCALE_STEP) * UI_SCALE_STEP;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, snapped));
}

function readCachedBase() {
  try {
    const cached = Number(sessionStorage.getItem(BASE_ZOOM_KEY));
    return Number.isFinite(cached) && cached > 0 ? cached : null;
  } catch {
    return null;
  }
}

function cacheBase(value: number) {
  try {
    sessionStorage.setItem(BASE_ZOOM_KEY, String(value));
  } catch {}
}

async function measureBaseZoom() {
  const cached = readCachedBase();
  if (cached) return cached;
  let base = 1;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const monitorScale = await getCurrentWindow().scaleFactor();
    const webviewDpr = window.devicePixelRatio;
    if (monitorScale > 1 && webviewDpr < monitorScale * 0.8) {
      base = monitorScale / webviewDpr;
    }
  } catch {}
  cacheBase(base);
  return base;
}

async function applyZoom(uiScale: number) {
  try {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview');
    await getCurrentWebview().setZoom(baseZoom * (clampUiScale(uiScale) / 100));
  } catch {}
}

function stepUiScale(direction: 1 | -1) {
  const { uiScale, setUiScale } = useSettingsStore.getState();
  const next = clampUiScale(uiScale + direction * UI_SCALE_STEP);
  if (next !== uiScale) setUiScale(next);
  announce(next);
}

function resetUiScale() {
  useSettingsStore.getState().setUiScale(UI_SCALE_DEFAULT);
  announce(UI_SCALE_DEFAULT);
}

function announce(value: number) {
  toast(i18n.t('settings.uiScaleToast', { value }), { id: 'ui-scale', duration: 1400 });
}

function isZoomModifier(e: KeyboardEvent | WheelEvent) {
  return (e.ctrlKey || e.metaKey) && !e.altKey;
}

const ZOOM_IN_CODES = new Set(['Equal', 'NumpadAdd']);
const ZOOM_OUT_CODES = new Set(['Minus', 'NumpadSubtract']);
const ZOOM_RESET_CODES = new Set(['Digit0', 'Numpad0']);

function keyIntent(e: KeyboardEvent) {
  if (ZOOM_IN_CODES.has(e.code) || e.key === '+' || e.key === '=') return 'in';
  if (ZOOM_OUT_CODES.has(e.code) || e.key === '-') return 'out';
  if (ZOOM_RESET_CODES.has(e.code) || e.key === '0') return 'reset';
  return null;
}

function onKeyDown(e: KeyboardEvent) {
  if (!isZoomModifier(e)) return;
  const intent = keyIntent(e);
  if (!intent) return;
  e.preventDefault();
  if (intent === 'reset') resetUiScale();
  else stepUiScale(intent === 'in' ? 1 : -1);
}

function createWheelHandler() {
  let accumulated = 0;
  let lastAt = 0;
  return (e: WheelEvent) => {
    if (!isZoomModifier(e)) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastAt > WHEEL_IDLE_MS) accumulated = 0;
    lastAt = now;
    const delta = e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? e.deltaY : e.deltaY * WHEEL_NOTCH;
    accumulated += delta;
    if (Math.abs(accumulated) < WHEEL_NOTCH) return;
    stepUiScale(accumulated < 0 ? 1 : -1);
    accumulated = 0;
  };
}

export async function initUiScale() {
  baseZoom = await measureBaseZoom();
  await applyZoom(useSettingsStore.getState().uiScale);
  useSettingsStore.subscribe((state, prev) => {
    if (state.uiScale !== prev.uiScale) void applyZoom(state.uiScale);
  });
  window.addEventListener('keydown', onKeyDown, { capture: true });
  window.addEventListener('wheel', createWheelHandler(), { passive: false });
}
