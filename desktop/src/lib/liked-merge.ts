import type { Track } from '../stores/player';

export interface LikedSnapshot {
  complete: boolean;
  confirmedEmpty?: boolean;
}

export function mergeLikedUrns(
  local: string[],
  server: string[],
  { complete, confirmedEmpty = false }: LikedSnapshot,
): string[] {
  if (complete && (server.length > 0 || confirmedEmpty)) return [...new Set(server)];
  const merged = new Set(server);
  for (const urn of local) merged.add(urn);
  return [...merged];
}

export function mergeLikedTracks(
  local: Track[],
  server: Track[],
  snapshot: LikedSnapshot,
): Track[] {
  const byUrn = new Map(local.map((track) => [track.urn, track]));
  for (const track of server) byUrn.set(track.urn, track);
  return mergeLikedUrns(
    local.map((track) => track.urn),
    server.map((track) => track.urn),
    snapshot,
  ).flatMap((urn) => byUrn.get(urn) ?? []);
}
