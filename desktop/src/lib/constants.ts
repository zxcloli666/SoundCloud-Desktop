const service = (label: string) => `https://${label}.scnative.dev`;

export const API_BASE = import.meta.env.VITE_API_BASE || service('api');
/** Резервный star-хост API для премиума (роутинг в `api-client.ts`). */
export const API_STAR_BASE = import.meta.env.VITE_API_STAR_BASE || service('api-star');
export const STREAMING_BASE = import.meta.env.VITE_STREAMING_BASE || service('stream');
export const STREAMING_PREMIUM_BASE =
  import.meta.env.VITE_STREAMING_PREMIUM_BASE || service('stream-star');
export const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || service('images');
export const STORAGE_BASE = import.meta.env.VITE_STORAGE_BASE || service('storage');
/** Резервная точка отдачи медиа для премиума (S3 read-only на star-host). */
export const STORAGE_PREMIUM_BASE =
  import.meta.env.VITE_STORAGE_PREMIUM_BASE || service('storage-star');
/** STAR payment backend (separate service; not host-routed like the catalog API). */
export const PAY_BASE = import.meta.env.VITE_PAY_BASE || service('pay');
export const STATUS_PAGE_URL =
  import.meta.env.VITE_STATUS_PAGE_URL || 'https://status.getsoundcloud.app';

export const GITHUB_OWNER = 'zxcloli666';
export const GITHUB_REPO = 'SoundCloud-Desktop';
export const GITHUB_REPO_EN = 'SoundCloud-Desktop-EN';
export const DOCS_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/main/docs`;
export const THEMES_RAW_BASE =
  import.meta.env.VITE_THEMES_RAW_BASE ||
  `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const THEMES_GUIDE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/main/themes`;
export const DISCORD_URL = 'https://discord.gg/xQcGBP8fGG';
export const BOOSTY_URL = 'https://boosty.to/lolinamide';
export const ANDROID_CLIENT_URL = 'https://github.com/okeydw/SoundCloud-Android';
export const ANDROID_CLIENT_RELEASES_URL = `${ANDROID_CLIENT_URL}/releases/latest`;
export const IOS_CLIENT_URL = 'https://github.com/okeydw/SoundCloud-IOS';
export const IOS_CLIENT_RELEASES_URL = `${IOS_CLIENT_URL}/releases/latest`;
/** Prefilled GitHub issue for new-language requests. */
export const REQUEST_LANGUAGE_URL =
  `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/new` +
  `?title=${encodeURIComponent('Language request: ')}` +
  `&body=${encodeURIComponent(
    'Language / Язык: \n\n' +
      '<!-- Which language would you like to see in SoundCloud Desktop? / Какой язык вы хотите видеть в приложении? -->\n\n' +
      'Why / Почему: \n\n' +
      '<!-- Optional: are you ready to help with the translation? / По желанию: готовы ли вы помочь с переводом? -->\n',
  )}`;
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
