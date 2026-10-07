export type EntityKind = 'tracks' | 'playlists' | 'users';

type IdInput = string | number | null | undefined;

const KINDS: ReadonlySet<string> = new Set<EntityKind>(['tracks', 'playlists', 'users']);
const ID = /^[1-9]\d{0,18}$/;
const URN = /^soundcloud:(tracks|playlists|users):([1-9]\d{0,18})$/;

function parseUrn(value: string): { kind: EntityKind; id: string } | null {
  const match = URN.exec(value);
  return match ? { kind: match[1] as EntityKind, id: match[2] } : null;
}

export function isEntityKind(value: string): value is EntityKind {
  return KINDS.has(value);
}

export function toUrn(kind: EntityKind, value: IdInput): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (ID.test(raw)) return `soundcloud:${kind}:${raw}`;
  return parseUrn(raw)?.kind === kind ? raw : null;
}

export function trackUrn(value: IdInput): string | null {
  return toUrn('tracks', value);
}

export function userUrn(value: IdInput): string | null {
  return toUrn('users', value);
}

export function kindOf(urn: string): EntityKind | null {
  return parseUrn(urn)?.kind ?? null;
}

export function idOf(urn: string): string | null {
  return parseUrn(urn)?.id ?? null;
}
