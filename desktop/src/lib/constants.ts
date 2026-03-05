export const API_BASE = 'https://backend.soundcloud.work.gd';

export const GITHUB_OWNER = 'zxcloli666';
export const GITHUB_REPO = 'SoundCloud-Desktop';
export const APP_VERSION = __APP_VERSION__;

let _cacheServerPort: number | null = null;

export function setCacheServerPort(port: number) {
  _cacheServerPort = port;
}

export function getCacheServerPort(): number | null {
  return _cacheServerPort;
}
