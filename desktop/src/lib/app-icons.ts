export const APP_ICONS = [
  'ember',
  'glass',
  'dusk',
  'wave',
  'porcelain',
  'sakura',
  'vinyl',
  'aurora',
  'neon',
  'moon',
  'mono',
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
