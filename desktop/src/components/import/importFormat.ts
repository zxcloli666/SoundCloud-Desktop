export function formatEta(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function finderQuery(artist: string, title: string): string {
  const lead = artist.split(/,|&|\s(?:feat\.?|ft\.?|x)\s/i)[0].trim();
  const bare = title.replace(/\s*[([][^)\]]*[)\]]/g, '').trim();
  return `${lead} ${bare || title}`.trim();
}

export function etaOf(startedAt: number, current: number, total: number): number | null {
  if (current < 20 || total <= current) return null;
  const perTrack = (Date.now() - startedAt) / current;
  return perTrack * (total - current);
}
