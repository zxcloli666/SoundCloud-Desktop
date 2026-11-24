const REST = 'rest';

export function staysLast(id: string) {
  return id === REST;
}

export function restLast<T extends { id: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => Number(staysLast(a.id)) - Number(staysLast(b.id)));
}
