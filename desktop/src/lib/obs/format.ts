import type { ObsTheme } from '../../stores/settings';

export const OBS_DEFAULT_TEMPLATE = '{artist} - {title}';
export const OBS_TOKENS = ['{artist}', '{title}'] as const;

export interface OverlayOptions {
  port: number;
  theme: ObsTheme;
  progress: boolean;
  hidePaused: boolean;
  lang: string;
  scale?: number;
}

export function obsOrigin(port: number): string {
  return `http://127.0.0.1:${port}`;
}

export function overlayUrl({ port, theme, progress, hidePaused, lang, scale }: OverlayOptions) {
  const params = new URLSearchParams({ theme, lang });
  if (!progress) params.set('progress', '0');
  if (hidePaused) params.set('hide', 'paused');
  if (scale) params.set('scale', String(scale));
  return `${obsOrigin(port)}/overlay?${params}`;
}

export function renderTemplate(template: string, artist: string, title: string): string {
  const source = template.trim() ? template : OBS_DEFAULT_TEMPLATE;
  return source
    .replace(/\{artist\}/g, () => artist.trim())
    .replace(/\{title\}/g, () => title.trim())
    .replace(/\\n/g, '\n');
}

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}
