export function toCompactCount(n?: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function replaceArtSize(url: string | null | undefined, size = 't500x500') {
  return url?.replace('-large', `-${size}`) ?? null;
}

export function toMinSec(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function toHourMinSec(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function toRelativeTime(dateStr: string): string {
  const d = new Date(dateStr.replace(/\//g, '-').replace(' +0000', 'Z'));
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d`;
  const w = Math.floor(dd / 7);
  if (w < 5) return `${w}w`;
  const mo = Math.floor(dd / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(dd / 365)}y`;
}

export function dateFormatted(dateStr: string): string {
  const d = new Date(dateStr.replace(/\//g, '-').replace(' +0000', 'Z'));
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
