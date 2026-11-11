export const NOTES_CAP = 30;
export const NOTE_MAX = 160;
const LOOSE_MIN = 3;

export type Forgot = 'ok' | 'not_found' | 'ambiguous';

function tidy(text: string): string {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, NOTE_MAX).join('');
}

function fold(text: string): string {
  return tidy(text)
    .toLowerCase()
    .replace(/[.!?…]+$/u, '');
}

export function addNote(notes: string[], text: string): string[] {
  const note = tidy(text);
  if (!note) return notes;
  const key = fold(note);
  return [...notes.filter((n) => fold(n) !== key), note].slice(-NOTES_CAP);
}

export function dropNote(notes: string[], text: string): { notes: string[]; state: Forgot } {
  const key = fold(text);
  const same = notes.filter((n) => fold(n) === key);
  const loose = key.length < LOOSE_MIN ? [] : notes.filter((n) => fold(n).includes(key));
  const hits = same.length > 0 ? same : loose;
  if (hits.length === 0) return { notes, state: 'not_found' };
  if (same.length === 0 && hits.length > 1) return { notes, state: 'ambiguous' };
  return { notes: notes.filter((n) => !hits.includes(n)), state: 'ok' };
}
