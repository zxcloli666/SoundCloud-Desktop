import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const UNIT_KEYS = ['b', 'kb', 'mb', 'gb'];

export function formatBytes(bytes: number, units: string[]): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

export function useFormatBytes() {
  const { t } = useTranslation();
  const units = UNIT_KEYS.map((k) => t(`voice.units.${k}`));
  const key = units.join('|');
  return useCallback((bytes: number) => formatBytes(bytes, key.split('|')), [key]);
}

export function percent(done: number, total: number): number {
  return total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : 0;
}
