import { useMemo } from 'react';
import { useBlockedArtistsStore } from '../stores/blocked-artists';
import type { Track } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import { type BlockedArtist, blockedArtistMatcher, useBlocklistVersion } from './blocked-artists';
import { keywordMatcher, useBlockedKeywords } from './keyword-filter';

export type FeedFilter = (track: Track) => boolean;

function feedFilter(entries: BlockedArtist[], keywords: string[]): FeedFilter {
  const blocked = blockedArtistMatcher(entries);
  const matchesKeyword = keywordMatcher(keywords);
  return (track) => !blocked(track) && !matchesKeyword(track);
}

function currentFeedFilter(): FeedFilter {
  return feedFilter(
    useBlockedArtistsStore.getState().entries,
    useSettingsStore.getState().blockedKeywords,
  );
}

export function withoutHidden<T extends Track>(tracks: T[]): T[] {
  return tracks.filter(currentFeedFilter());
}

export function useFeedFilter(): FeedFilter {
  const entries = useBlocklistVersion();
  const keywords = useBlockedKeywords();
  return useMemo(() => feedFilter(entries, keywords), [entries, keywords]);
}
