const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
];

export function ago(at: number, now: number, lang: string): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' });
  let value = Math.round((at - now) / 1000);
  for (const [unit, size] of STEPS) {
    if (Math.abs(value) < size) return rtf.format(value, unit);
    value = Math.round(value / size);
  }
  return rtf.format(value, 'year');
}

export function clockTime(at: number, lang: string): string {
  return new Date(at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}

export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
