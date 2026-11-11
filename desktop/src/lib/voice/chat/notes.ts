export const NOTES_CAP = 30;
export const NOTE_MAX = 160;
const LOOSE_MIN = 3;

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

export function dropNotes(notes: string[], text: string): string[] {
  const key = fold(text);
  if (!key) return notes;
  const exact = notes.filter((n) => fold(n) !== key);
  if (exact.length < notes.length) return exact;
  return key.length < LOOSE_MIN ? notes : notes.filter((n) => !fold(n).includes(key));
}
