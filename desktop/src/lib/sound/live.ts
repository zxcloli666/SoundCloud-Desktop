export type SoundToken =
  | { id: 'fx'; preset: string }
  | { id: 'eq' }
  | { id: 'rate'; rate: number }
  | { id: 'pitch'; semitones: number }
  | { id: 'sleep' }
  | { id: 'loop' };

export interface SoundSnapshot {
  fx: string | null;
  fxRate: number;
  eq: boolean;
  rate: number;
  pitch: number | null;
  sleep: boolean;
  loop: boolean;
}

const NEAR = 0.001;

export function soundTokens(s: SoundSnapshot): SoundToken[] {
  const tokens: SoundToken[] = [];
  const restRate = s.fx ? s.fxRate : 1;
  if (s.fx) tokens.push({ id: 'fx', preset: s.fx });
  if (s.sleep) tokens.push({ id: 'sleep' });
  if (Math.abs(s.rate - restRate) >= NEAR) tokens.push({ id: 'rate', rate: s.rate });
  if (s.pitch !== null && Math.abs(s.pitch) >= NEAR) {
    tokens.push({ id: 'pitch', semitones: s.pitch });
  }
  if (s.loop) tokens.push({ id: 'loop' });
  if (s.eq) tokens.push({ id: 'eq' });
  return tokens;
}

const WORDLESS: ReadonlySet<SoundToken['id']> = new Set(['eq', 'loop']);

export function speaksForItself(tokens: readonly SoundToken[]) {
  return tokens.some((token) => !WORDLESS.has(token.id));
}

export function formatRate(rate: number) {
  return `${Number(rate.toFixed(2))}x`;
}

export function formatPitch(semitones: number) {
  if (Math.abs(semitones) < NEAR) return '0';
  return `${semitones > 0 ? '+' : ''}${Number(semitones.toFixed(1))}`;
}
