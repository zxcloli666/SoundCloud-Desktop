import { API_BASE } from './constants';

let cdnBlocked = false;

export function isCdnBlocked() {
  return cdnBlocked;
}

export function markCdnBlocked() {
  cdnBlocked = true;
}

function isSndcdnHost(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.sndcdn.com');
  } catch {
    return false;
  }
}

export function proxiedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (cdnBlocked && isSndcdnHost(url)) {
    return `${API_BASE}/proxy/cdn?url=${encodeURIComponent(url)}`;
  }
  return url;
}
