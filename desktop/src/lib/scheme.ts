import {useSyncExternalStore} from 'react';

export type Scheme = 'dark' | 'white';
export type SchemeChoice = Scheme | 'system';

export const WHITE_BG = '#f5f5f7';

const INK = '#16141c';
const MAX_ACCENT_LUMINANCE = 0.3;

function media() {
    return window.matchMedia('(prefers-color-scheme: light)');
}

function subscribe(onChange: () => void) {
    const query = media();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

export function systemScheme(): Scheme {
    return media().matches ? 'white' : 'dark';
}

export function useSystemScheme(): Scheme {
    return useSyncExternalStore(subscribe, systemScheme);
}

function subscribeActive(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ['data-scheme']});
    return () => observer.disconnect();
}

export function activeScheme(): Scheme {
    return document.documentElement.dataset.scheme === 'white' ? 'white' : 'dark';
}

export function useScheme(): Scheme {
    return useSyncExternalStore(subscribeActive, activeScheme);
}

export function resolveScheme(choice: SchemeChoice, system: Scheme): Scheme {
    return choice === 'system' ? system : choice;
}

function linear(channel: number) {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: number[]) {
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function toHex(channels: number[]) {
    return `#${channels.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

export function fitAccent(hex: string, scheme: Scheme): string {
    if (scheme === 'dark' || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    const lum = luminance(channels);
    if (lum <= MAX_ACCENT_LUMINANCE) return hex;
    if (Math.max(...channels) - Math.min(...channels) < 40) return INK;
    const scale = (MAX_ACCENT_LUMINANCE / lum) ** (1 / 2.2);
    return toHex(channels.map((c) => c * scale));
}
