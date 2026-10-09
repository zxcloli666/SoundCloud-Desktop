type WriteListener = (path: string) => void;

const listeners = new Set<WriteListener>();

export function onApiWrite(listener: WriteListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitApiWrite(path: string): void {
  for (const listener of listeners) listener(path);
}
