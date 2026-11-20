type Go = (to: string, options?: { state?: unknown }) => void;

let go: Go | null = null;
let page = '/';

export function bindNavigator(next: Go | null) {
  go = next;
}

export function setPage(path: string) {
  page = path;
}

export function currentPage(): string {
  return page;
}

export function goTo(to: string, state?: unknown): boolean {
  if (!go) return false;
  go(to, state === undefined ? undefined : { state });
  return true;
}
