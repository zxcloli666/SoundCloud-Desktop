export const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.scnative.space';
/** Резервный star-хост API для премиума (роутинг в `api-client.ts`). */
export const API_STAR_BASE =
  import.meta.env.VITE_API_STAR_BASE || 'https://api-star.scnative.space';
export const STREAMING_BASE =
  import.meta.env.VITE_STREAMING_BASE || 'https://stream.scnative.space';
export const STREAMING_PREMIUM_BASE =
  import.meta.env.VITE_STREAMING_PREMIUM_BASE || 'https://stream-star.scnative.space';
export const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || 'https://images.scnative.space';
export const STORAGE_BASE = import.meta.env.VITE_STORAGE_BASE || 'https://storage.scnative.space';
/** STAR payment backend (separate service; not host-routed like the catalog API). */
export const PAY_BASE = import.meta.env.VITE_PAY_BASE || 'https://pay.scnative.space';

export const GITHUB_OWNER = 'zxcloli666';
export const GITHUB_REPO = 'SoundCloud-Desktop';
export const GITHUB_REPO_EN = 'SoundCloud-Desktop-EN';
export const APP_VERSION = __APP_VERSION__;

export const SHOW_NEWS = true;
export const CHECK_UPDATES = true;

export interface NewsItem {
  id: string;
  /** Optional image URL (artwork, banner, etc.) */
  image?: string;
  /** i18n key for the toast title */
  titleKey: string;
  /** i18n key for the toast short description */
  descriptionKey: string;
  /** i18n key for the full modal body */
  bodyKey: string;
  /** Accent color override (tailwind class, e.g. 'violet' | 'amber' | 'sky') */
  accent?: string;
}

/**
 * All news items, newest first.
 * Add new entries at the top. Once irrelevant, remove them.
 */
export const NEWS: NewsItem[] = [
  {
    id: 'discord-server-2025-04',
    titleKey: 'news.discord.title',
    descriptionKey: 'news.discord.description',
    bodyKey: 'news.discord.body',
    accent: 'sky',
  },
];

let _staticPort: number | null = null;
let _proxyPort: number | null = null;

export function setServerPorts(staticP: number, proxy: number) {
  _staticPort = staticP;
  _proxyPort = proxy;
}

export function getStaticPort(): number | null {
  return _staticPort;
}

export function getProxyPort(): number | null {
  return _proxyPort;
}
