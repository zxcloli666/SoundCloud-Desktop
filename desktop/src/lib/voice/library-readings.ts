import type { OwnedTrack } from './library.ts';
import type { Readings } from './readings.ts';
import type { VoiceLanguage } from './types.ts';

const MOST_ASKS = 40;
const NAMES_PER_ASK = 500;
const MOST_SPOKEN = 200;
const LATIN = /[a-z]/i;
const CYRILLIC = /[а-яё]/i;

export type Heard = Record<string, string[]>;

export interface ReadingsAnswer {
  readings: { name: string; said: string[] }[];
  left: number;
}

export type AskReadings = (language: VoiceLanguage, names: string[]) => Promise<ReadingsAnswer>;

export function keyOf(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function unspoken(language: VoiceLanguage, name: string): boolean {
  const latin = LATIN.test(name);
  const cyrillic = CYRILLIC.test(name);
  return language === 'ru' ? latin && !cyrillic : cyrillic && !latin;
}

export function libraryNames(
  language: VoiceLanguage,
  artists: string[],
  tracks: OwnedTrack[],
): string[] {
  const named = [...artists, ...tracks.flatMap((track) => [track.name, track.artist])];
  const seen = new Set<string>();
  return named.filter((name) => {
    const key = keyOf(name);
    if (!key || seen.has(key) || !unspoken(language, name)) return false;
    seen.add(key);
    return true;
  });
}

export async function readNames(
  language: VoiceLanguage,
  names: string[],
  ask: AskReadings,
): Promise<Heard> {
  const heard: Heard = {};
  let rounds = 0;
  for (let at = 0; at < names.length && rounds < MOST_ASKS; at += NAMES_PER_ASK) {
    const part = names.slice(at, at + NAMES_PER_ASK);
    let left = Number.POSITIVE_INFINITY;
    while (rounds < MOST_ASKS) {
      rounds++;
      const answer = await ask(language, part).catch(() => null);
      if (!answer) return heard;
      for (const { name, said } of answer.readings) heard[keyOf(name)] = said;
      if (answer.left === 0 || answer.left >= left) break;
      left = answer.left;
    }
  }
  return heard;
}

export function withAsked(heard: Heard, asked: Readings): Heard {
  const joined: Heard = { ...heard };
  for (const [key, said] of Object.entries(asked)) {
    joined[key] = [...new Set([said, ...(heard[key] ?? [])])];
  }
  return joined;
}

export function withReadings(tracks: OwnedTrack[], heard: Heard): OwnedTrack[] {
  const of = (name: string) => heard[keyOf(name)] ?? [];
  return tracks.map((track) => ({ ...track, said: of(track.name), artistSaid: of(track.artist) }));
}

export function spokenNames(
  language: VoiceLanguage,
  asked: Readings,
  artists: string[],
  favourite: OwnedTrack[],
  heard: Heard,
): string[] {
  const said = (name: string) => (unspoken(language, name) ? (heard[keyOf(name)] ?? []) : [name]);
  const recent = Object.values(asked).reverse();
  const named = [
    ...recent,
    ...artists.flatMap(said),
    ...favourite.flatMap((track) => said(track.name)),
  ];
  const kept = named.filter((name): name is string => Boolean(name?.trim()));
  return [...new Set(kept)].slice(0, MOST_SPOKEN);
}
