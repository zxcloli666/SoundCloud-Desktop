const RELOAD_MARK = 'reload';

export interface Sentinel {
  id: string;
  hash: string;
  reload: boolean;
}

export function sentinelText(id: string, hash: string): string {
  return `${id} ${hash}`;
}

export function parseSentinel(text: string): Sentinel | null {
  const [id, hash, mark] = text.trim().split(' ');
  return id && hash ? { id, hash, reload: mark === RELOAD_MARK } : null;
}

export function reloadText(text: string): string | null {
  const sentinel = parseSentinel(text);
  return sentinel ? `${sentinelText(sentinel.id, sentinel.hash)} ${RELOAD_MARK}` : null;
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
