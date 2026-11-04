import { useTranslation } from 'react-i18next';

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
const formats = new Map<string, Intl.NumberFormat>();

function formatter(lang: string, unit: number, digits: number): Intl.NumberFormat {
  const key = `${lang}:${unit}:${digits}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(lang, {
      style: 'unit',
      unit: UNITS[unit],
      unitDisplay: 'short',
      maximumFractionDigits: digits,
    });
    formats.set(key, format);
  }
  return format;
}

function digitsFor(value: number, unit: number): number {
  if (unit === 0 || value >= 100) return 0;
  if (value >= 10 || unit === 1) return 1;
  return unit === 3 ? 2 : 1;
}

export function formatSize(bytes: number, lang: string): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return formatter(lang, unit, digitsFor(value, unit)).format(value);
}

export function useFormatSize(): (bytes: number) => string {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  return (bytes) => formatSize(bytes, lang);
}
