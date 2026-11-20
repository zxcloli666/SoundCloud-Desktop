type LevelListener = (input: string, rms: number) => void;

export const SPEECH = 'speech';

const levels = new Map<string, number>();
const listeners = new Set<LevelListener>();

export function pushLevel(input: string, rms: number) {
  levels.set(input, rms);
  for (const listener of listeners) listener(input, rms);
}

export function onLevel(listener: LevelListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function levelOf(input: string): number {
  return levels.get(input) ?? 0;
}

export function loudest(): number {
  let max = 0;
  for (const [input, value] of levels) if (input !== SPEECH) max = Math.max(max, value);
  return max;
}

export function resetLevels() {
  levels.clear();
}
