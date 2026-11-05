const RELOAD_MARK = 'reload';

export interface Sentinel {
  id: string;
  hash: string;
  reload: boolean;
}

export function sentinelText(id: string, hash: string, page: string): string {
  return `${id} ${hash} ${page}`;
}

export function parseSentinel(text: string): Sentinel | null {
  const [id, hash, ...rest] = text.trim().split(' ');
  return id && hash ? { id, hash, reload: rest.includes(RELOAD_MARK) } : null;
}

export function crashedTheme(
  sentinel: Sentinel | null,
  activeId: string | null,
  hash: string | null,
): sentinel is Sentinel {
  return (
    sentinel !== null && !sentinel.reload && sentinel.id === activeId && sentinel.hash === hash
  );
}
