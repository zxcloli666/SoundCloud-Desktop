import { matchesTerms, queryTerms, searchKey } from './search-key.ts';

export function pickByTitle<T extends { title: string }>(playlists: T[], name: string): T | null {
  const wanted = searchKey(name);
  const terms = queryTerms(name);
  if (terms.length === 0) return null;
  return (
    playlists.find((playlist) => searchKey(playlist.title) === wanted) ??
    playlists.find((playlist) => searchKey(playlist.title).startsWith(wanted)) ??
    playlists.find((playlist) => matchesTerms(terms, playlist.title)) ??
    null
  );
}
