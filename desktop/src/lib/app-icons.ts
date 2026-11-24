export const APP_ICONS = [
  'ember',
  'mono',
  'glass',
  'dusk',
  'wave',
  'porcelain',
  'sakura',
  'vinyl',
  'aurora',
  'neon',
  'moon',
  'holo',
  'paper',
  'pixel',
  'jelly',
  'gold',
  'phones',
  'cat',
  'synthwave',
  'cassette',
  'classic',
] as const;

export type AppIconId = (typeof APP_ICONS)[number];

export const DEFAULT_APP_ICON: AppIconId = 'ember';
