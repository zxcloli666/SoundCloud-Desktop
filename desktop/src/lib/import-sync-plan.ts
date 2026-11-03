import type { HistoryEntry, ImportRequest, SyncSource, SyncTarget } from './import-session.ts';

export const PLAYLIST_LIMIT = 500;

export interface Chunk {
  urn: string;
  count: number;
}

export interface AppendStep {
  urn: string | null;
  title: string;
  urns: string[];
}

export function chunkTitle(base: string, index: number): string {
  return index === 0 ? base : `${base} ${index + 1}`;
}

export function planAppend(base: string, chunks: Chunk[], urns: string[]): AppendStep[] {
  const steps: AppendStep[] = [];
  let next = 0;
  chunks.forEach((chunk, index) => {
    const room = Math.max(0, PLAYLIST_LIMIT - chunk.count);
    const part = urns.slice(next, next + room);
    next += part.length;
    if (part.length > 0) steps.push({ urn: chunk.urn, title: chunkTitle(base, index), urns: part });
  });
  for (let index = chunks.length; next < urns.length; index++) {
    const part = urns.slice(next, next + PLAYLIST_LIMIT);
    next += part.length;
    steps.push({ urn: null, title: chunkTitle(base, index), urns: part });
  }
  return steps;
}

export function stripToken(request: ImportRequest): ImportRequest {
  if (request.kind === 'ym_likes' || request.kind === 'ym_playlist') {
    return { ...request, token: '' };
  }
  if (request.kind === 'link') return { kind: 'link', url: request.url };
  return request;
}

export function withToken(request: ImportRequest, token: string | null): ImportRequest {
  if (!token) return request;
  if (request.kind === 'ym_likes' || request.kind === 'ym_playlist') return { ...request, token };
  if (request.kind === 'link') return { ...request, token };
  return request;
}

export function tokenOf(request: ImportRequest): string | null {
  if (request.kind === 'text') return null;
  return request.token?.trim() || null;
}

export function needsToken(request: ImportRequest): boolean {
  return request.kind === 'ym_likes' || request.kind === 'ym_playlist';
}

export function syncSourceOf(request: ImportRequest, target: SyncTarget): SyncSource {
  return { request: stripToken(request), target };
}

export function cleanHistory(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.map((entry) =>
    entry.sync
      ? { ...entry, sync: { ...entry.sync, request: stripToken(entry.sync.request) } }
      : entry,
  );
}
