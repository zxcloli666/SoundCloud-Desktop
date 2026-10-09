const TRACKING_PARAMS = ['utm_medium', 'utm_campaign', 'utm_source'];

export function cleanPermalink(url: string): string {
  try {
    const u = new URL(url);
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    return u.toString().replace(/\?$/, '');
  } catch {
    return url;
  }
}
