const LAST_JANUARY_DAY = 10;

/** Fewer plays than this make a recap of empty slides. */
export const RECAP_MIN_PLAYS = 20;

/** The year a recap covers right now: all of December and the first days of January, else null. */
export function recapYear(now = new Date()): number | null {
  if (now.getMonth() === 11) return now.getFullYear();
  if (now.getMonth() === 0 && now.getDate() <= LAST_JANUARY_DAY) return now.getFullYear() - 1;
  return null;
}
