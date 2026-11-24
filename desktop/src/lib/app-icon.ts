import classic from '../assets/app-icons/classic.png';
import { useSettingsStore } from '../stores/settings';
import type { AppIconId } from './app-icons';
import { trackedInvoke as invoke, logError } from './diagnostics';

const drawn = import.meta.glob<string>('../assets/app-icons/*.webp', {
  eager: true,
  import: 'default',
});

let pushing = Promise.resolve();

export function appIconUrl(id: AppIconId): string {
  return drawn[`../assets/app-icons/${id}.webp`] ?? classic;
}

export function initAppIcon() {
  push();
  useSettingsStore.subscribe((state, prev) => {
    if (state.appIcon !== prev.appIcon) push();
  });
}

function push() {
  pushing = pushing
    .then(() => send(useSettingsStore.getState().appIcon))
    .catch((error) => logError(`[AppIcon] ${error}`));
}

async function send(id: AppIconId) {
  const url = drawn[`../assets/app-icons/${id}.webp`];
  if (!url) return invoke<void>('app_icon_reset');
  return invoke<void>('app_icon_set', await toPng(url));
}

async function toPng(url: string): Promise<Uint8Array> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d')?.drawImage(image, 0, 0);
  const png = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
  if (!png) throw new Error('the icon could not be drawn');
  return new Uint8Array(await png.arrayBuffer());
}
