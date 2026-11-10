/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare module 'virtual:settings-index' {
  export const entries: import('./lib/settings-search/types').SettingsEntry[];
  export const categories: import('./lib/settings-search/types').SettingsCategoryInfo[];
}
