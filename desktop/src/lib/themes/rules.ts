export const THEME_LIMITS = {
  cssBytes: 262_144,
  dataUriChars: 65_536,
  assetBytes: 1_048_576,
  assetsTotalBytes: 3_145_728,
  assetsCount: 24,
  assetMaxSide: 4096,
  previewBytes: 262_144,
  previewMinWidth: 960,
  previewMaxWidth: 1600,
  previewMinAspect: 1.4,
  previewMaxAspect: 1.8,
  indexBytes: 2_097_152,
} as const;

export const TEXT_LIMITS = { name: 32, description: 140, authorName: 40 } as const;

export const THEME_ID = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
export const THEME_RESERVED_IDS = ['tools'] as const;
export const THEME_ASSET_NAME =
  /^[a-z0-9][a-z0-9_-]{0,47}\.(webp|png|jpg|jpeg|avif|gif|svg|woff2)$/;
export const THEME_PREVIEW_PATHS = ['preview.webp', 'preview.png'] as const;
export const SHA256 = /^[0-9a-f]{64}$/;
export const GIT_REV = /^[0-9a-f]{40}$/;
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const HEX_COLOR = /^#[0-9a-f]{6}$/;
export const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

export const THEME_FONTS = [
  'inter',
  'manrope',
  'onest',
  'golos',
  'montserrat',
  'rubik',
  'nunito',
  'raleway',
  'comfortaa',
  'system',
] as const;
export const THEME_LICENSES = [
  'MIT',
  'Apache-2.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
] as const;
export const THEME_LANGS = ['en', 'ru', 'tr', 'ko', 'pt'] as const;
export const THEME_SCHEMES = ['dark', 'white'] as const;

export type ThemeFont = (typeof THEME_FONTS)[number];
export type ThemeScheme = (typeof THEME_SCHEMES)[number];
export type AssetType = 'webp' | 'png' | 'jpeg' | 'avif' | 'gif' | 'svg' | 'woff2';

const UNSAFE_TEXT = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const SVG_START = /^\uFEFF?[ \t\r\n]*(?:<\?xml|<svg|<!--)/;

export function isThemePath(path: string): boolean {
  if (path === 'theme.css') return true;
  if ((THEME_PREVIEW_PATHS as readonly string[]).includes(path)) return true;
  return path.startsWith('assets/') && THEME_ASSET_NAME.test(path.slice(7));
}

export function isCleanText(text: string, max: number): boolean {
  if (text.length < 1 || text.length > max) return false;
  return text === text.trim() && !UNSAFE_TEXT.test(text);
}

export function compareVersions(a: string, b: string): number {
  const left = a.split('.');
  const right = b.split('.');
  for (let i = 0; i < 3; i++) {
    const x = left[i] ?? '';
    const y = right[i] ?? '';
    if (x.length !== y.length) return x.length < y.length ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function startsWith(bytes: Uint8Array, offset: number, signature: string): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature.charCodeAt(i)) return false;
  }
  return true;
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  let text: string;
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    text = decoder.decode(bytes.subarray(0, 1024), { stream: true });
  } catch {
    return false;
  }
  return SVG_START.test(text) && text.includes('<svg');
}

export function sniffAssetType(bytes: Uint8Array): AssetType | null {
  if (startsWith(bytes, 0, '\x89PNG\r\n\x1a\n')) return 'png';
  if (startsWith(bytes, 0, '\xff\xd8\xff')) return 'jpeg';
  if (startsWith(bytes, 0, 'GIF87a') || startsWith(bytes, 0, 'GIF89a')) return 'gif';
  if (startsWith(bytes, 0, 'RIFF') && startsWith(bytes, 8, 'WEBP')) return 'webp';
  if (
    startsWith(bytes, 4, 'ftyp') &&
    (startsWith(bytes, 8, 'avif') || startsWith(bytes, 8, 'avis'))
  ) {
    return 'avif';
  }
  if (startsWith(bytes, 0, 'wOF2')) return 'woff2';
  if (looksLikeSvg(bytes)) return 'svg';
  return null;
}

export interface ImageSize {
  width: number;
  height: number;
}

type SizeReader = (bytes: Uint8Array, view: DataView) => ImageSize | null;

const colorTableBytes = (flags: number) => (flags & 0x80 ? 3 << ((flags & 7) + 1) : 0);

const SIZE_READERS: Partial<Record<AssetType, SizeReader>> = {
  png(bytes, view) {
    if (!startsWith(bytes, 12, 'IHDR')) return null;
    return { width: view.getUint32(16), height: view.getUint32(20) };
  },

  webp(bytes, view) {
    if (startsWith(bytes, 12, 'VP8 ') && startsWith(bytes, 23, '\x9d\x01\x2a')) {
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    if (startsWith(bytes, 12, 'VP8L') && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (startsWith(bytes, 12, 'VP8X') && bytes.length >= 30) {
      return {
        width: (view.getUint16(24, true) | (bytes[26] << 16)) + 1,
        height: (view.getUint16(27, true) | (bytes[29] << 16)) + 1,
      };
    }
    return null;
  },

  gif(bytes, view) {
    let width = view.getUint16(6, true);
    let height = view.getUint16(8, true);
    let at = 13 + colorTableBytes(bytes[10]);
    while (at < bytes.length && bytes[at] !== 0x3b) {
      if (bytes[at] === 0x2c) {
        width = Math.max(width, view.getUint16(at + 1, true) + view.getUint16(at + 5, true));
        height = Math.max(height, view.getUint16(at + 3, true) + view.getUint16(at + 7, true));
        at += 11 + colorTableBytes(bytes[at + 9]);
      } else if (bytes[at] === 0x21) {
        at += 2;
      } else {
        return null;
      }
      while (at < bytes.length && bytes[at] !== 0) at += bytes[at] + 1;
      at++;
    }
    return { width, height };
  },

  jpeg(bytes, view) {
    let at = 2;
    while (at + 9 <= bytes.length) {
      const marker = bytes[at + 1];
      if (bytes[at] !== 0xff) return null;
      if (marker === 0xff) {
        at++;
      } else if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) };
      } else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        at += 2;
      } else {
        at += 2 + view.getUint16(at + 2);
      }
    }
    return null;
  },

  avif(bytes, view) {
    let width = 0;
    let height = 0;
    for (let at = 8; at + 16 <= bytes.length; at++) {
      if (!startsWith(bytes, at, 'ispe')) continue;
      width = Math.max(width, view.getUint32(at + 8));
      height = Math.max(height, view.getUint32(at + 12));
    }
    return { width, height };
  },
};

export function imageSize(bytes: Uint8Array): ImageSize | null {
  const type = sniffAssetType(bytes);
  const read = type ? SIZE_READERS[type] : undefined;
  if (!read) return null;
  try {
    const size = read(bytes, new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    return size && size.width > 0 && size.height > 0 ? size : null;
  } catch {
    return null;
  }
}
