const DAY_MS = 86_400_000;
const formats = new Map<string, Intl.DateTimeFormat>();

function format(language: string, key: string, options: Intl.DateTimeFormatOptions) {
  const id = `${language}:${key}`;
  let cached = formats.get(id);
  if (!cached) {
    cached = new Intl.DateTimeFormat(language, options);
    formats.set(id, cached);
  }
  return cached;
}

export function rowTime(ts: number, now: number, language: string): string {
  const date = new Date(ts);
  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) {
    return format(language, 'clock', { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  if (now - ts < 6 * DAY_MS) return format(language, 'weekday', { weekday: 'short' }).format(date);
  if (date.getFullYear() === today.getFullYear()) {
    return format(language, 'day', { day: 'numeric', month: 'short' }).format(date);
  }
  return format(language, 'date', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(
    date,
  );
}
