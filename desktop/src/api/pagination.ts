export type PageParam = Record<string, string>;

export function extractPagination(href: string | null): PageParam | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    const params: PageParam = {};
    for (const key of ['cursor', 'offset']) {
      const val = url.searchParams.get(key);
      if (val) params[key] = val;
    }
    return Object.keys(params).length > 0 ? params : undefined;
  } catch {
    return undefined;
  }
}
