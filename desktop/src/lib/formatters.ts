import i18n from 'i18next';
import {proxiedAssetUrl} from './asset-url';

/** SoundCloud artwork URL: replace -large with desired size */
export function art(url: string | null | undefined, size = 't500x500'): string | null {
  return proxiedAssetUrl(url?.replace('-large', `-${size}`) ?? null);
}

/** Format count: 1234 → "1.2K", 1234567 → "1.2M" */
export function fc(n?: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Format a byte count: 0 → "0 B", 1536 → "1.5 KB", 1.5e9 → "1.40 GB" */
export function formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Format duration from milliseconds: 185000 → "3:05" */
export function dur(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/** Format duration long: 3723000 → "1:02:03" */
export function durLong(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format seconds for player: 185.3 → "3:05" */
export function formatTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseScDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.replace(/\//g, '-').replace(' +0000', 'Z'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** SoundCloud timestamp → epoch ms (handles "2024/05/28 12:00:00 +0000" and ISO).
 *  Invalid/empty → 0, so it sorts last. Use this for chronological sorts; plain
 *  Date.parse chokes on SC's slash+offset format and returns NaN. */
export function scDateMs(dateStr: string | null | undefined): number {
    return parseScDate(dateStr)?.getTime() ?? 0;
}

/** Relative time: "2026-01-01T00:00:00Z" → "2mo". Пустой/невалидный → ''. */
export function ago(dateStr: string | null | undefined): string {
  const d = parseScDate(dateStr);
  if (!d) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return i18n.t('ago.now');
  const m = Math.floor(s / 60);
  if (m < 60) return i18n.t('ago.m', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return i18n.t('ago.h', { count: h });
  const dd = Math.floor(h / 24);
  if (dd < 7) return i18n.t('ago.d', { count: dd });
  const w = Math.floor(dd / 7);
  if (w < 5) return i18n.t('ago.w', { count: w });
  const mo = Math.floor(dd / 30);
  if (mo < 12) return i18n.t('ago.mo', { count: mo });
  return i18n.t('ago.y', { count: Math.floor(dd / 365) });
}

/** Formatted date: "2026-01-01" → "Jan 1, 2026". Пустой/невалидный → ''. */
export function dateFormatted(dateStr: string | null | undefined): string {
  const d = parseScDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
