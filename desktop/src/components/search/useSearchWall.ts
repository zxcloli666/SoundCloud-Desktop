import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDislikeVersion } from '../../lib/dislikes';
import { art } from '../../lib/formatters';
import {
  useLyricSearch,
  useSearchDbArtists,
  useSearchDbPlaylists,
  useSearchDbTracks,
  useSearchDbUsers,
  useSearchPlaylists,
  useSearchTracks,
  useSearchUsers,
  useVibeSearch,
} from '../../lib/hooks';
import { curateQueueRecommendations } from '../../lib/queue-recommendations';
import { useSmartWave, useWaveBoard } from '../../lib/soundwave';
import type { Track } from '../../stores/player';
import type { SearchMode, SearchSource } from '../../stores/searchPrefs';
import { useSettingsStore } from '../../stores/settings';
import type { EntityItem } from './EntityStrip';
import { genreColor, isHeroPos, isHeroUrn, vibeEnergy, type WallItem } from './utils';

export interface DiveSeed {
  urn: string;
  title: string;
}

export interface SearchWallResult {
  items: WallItem[];
  entities: EntityItem[];
  atmosphere: { tint: string[]; energy: number };
  isLoading: boolean;
  /** Vibe vector is still being computed by the worker (high load) — the wall
   *  is empty not because there are no matches, but because it isn't encoded
   *  yet. Drives the "preparing vibe" plaque; the query auto-refetches. */
  preparing: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  entitiesLoading: boolean;
  loadMore: () => void;
}

const MIN_LEN = 2;

function toTiles(tracks: Track[], kind: WallItem['kind']): WallItem[] {
  return tracks.filter((t) => t?.urn).map((track, i) => ({ track, kind, hero: isHeroPos(i) }));
}

/** Weave lexical + lyric + a pinch of vibe into one deduped wall (text mode). */
function weaveText(
  lex: Track[],
  lyric: { track: Track; matchedLine: string | null }[],
  vibe: Track[],
): WallItem[] {
  const out: WallItem[] = [];
  const seen = new Set<string>();
  let li = 0;
  let ly = 0;
  let vi = 0;
  let slot = 0;
  const push = (track: Track, kind: WallItem['kind'], matchedLine?: string | null): boolean => {
    if (!track?.urn || seen.has(track.urn)) return false;
    seen.add(track.urn);
    out.push({ track, kind, matchedLine });
    return true;
  };

  while (li < lex.length || ly < lyric.length || vi < vibe.length) {
    let placed = false;
    if (ly < lyric.length && slot % 4 === 2) {
      placed = push(lyric[ly].track, 'lyric', lyric[ly].matchedLine);
      ly++;
    } else if (vi < vibe.length && slot % 7 === 5) {
      placed = push(vibe[vi], 'vibe');
      vi++;
    } else if (li < lex.length) {
      placed = push(lex[li], 'lexical');
      li++;
    } else if (ly < lyric.length) {
      placed = push(lyric[ly].track, 'lyric', lyric[ly].matchedLine);
      ly++;
    } else if (vi < vibe.length) {
      placed = push(vibe[vi], 'vibe');
      vi++;
    }
    if (placed) slot++;
  }
  return out.map((it) => ({ ...it, hero: isHeroUrn(it.track.urn) }));
}

/** Decides what fills the wall for the current query/mode/source/dive, plus the
 *  atmosphere tint, the entity strip, and pagination. Keeps the page thin.
 *  source 'sc' searches the live SoundCloud (lexical only) instead of our DB. */
export function useSearchWall(
  query: string,
  mode: SearchMode,
  source: SearchSource,
  dive: DiveSeed | null,
): SearchWallResult {
  const navigate = useNavigate();
  const trimmed = query.trim();
  const hasQuery = trimmed.length >= MIN_LEN;
  const db = source === 'db';
  const landing = !hasQuery && !dive;
  const scMode = hasQuery && source === 'sc' && !dive;
  const textMode = hasQuery && mode === 'text' && db && !dive;
  const vibeMode = hasQuery && mode === 'vibe' && db && !dive;

  const recommendationLanguages = useSettingsStore((s) => s.soundwaveLanguages);
  const hideLiked = useSettingsStore((s) => s.soundwaveHideLiked);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const recommendationMode = useSettingsStore((s) => s.soundwaveMode);
  const dislikeVersion = useDislikeVersion();
  const stableLanguages = useMemo(
    () => [...recommendationLanguages].sort(),
    [recommendationLanguages],
  );
  const wave = useWaveBoard({
    enabled: landing,
    languages: stableLanguages,
    hideListened,
  });
  // Make the primary track search responsive before spending transport slots on
  // semantic/lyrics/entity enrichment. This avoids six requests racing audio on
  // every debounced keystroke while keeping all secondary results available.
  const lex = useSearchDbTracks(textMode ? trimmed : '');
  const primaryTextReady = textMode && !lex.isLoading;
  const lyric = useLyricSearch(primaryTextReady ? trimmed : '', 'auto');
  const vibeQ = vibeMode || primaryTextReady ? trimmed : '';
  // Text mode only needs a pinch of vibe tiles (+ a genre sample for atmosphere),
  // so cap it small instead of the full 48 used in dedicated vibe mode.
  const vibe = useVibeSearch(vibeQ, textMode ? { limit: 12 } : undefined);
  // Entity lookup is cheap and must not sit behind the optional lyric/vibe
  // enrichment requests (the vibe worker alone may legitimately take 30s).
  const entityQ = primaryTextReady ? trimmed : '';
  const artists = useSearchDbArtists(entityQ);
  const users = useSearchDbUsers(entityQ);
  const playlists = useSearchDbPlaylists(entityQ);
  // Live SoundCloud fan-out (only when the user opted into the SC source).
  const scQ = scMode ? trimmed : '';
  const scTracks = useSearchTracks(scQ);
  const scEntityQ = scMode && !scTracks.isLoading ? trimmed : '';
  const scPlaylists = useSearchPlaylists(scEntityQ);
  const scUsers = useSearchUsers(scEntityQ);
  // The wave/from-track endpoint parses the path segment as a bare numeric id;
  // a full URN (soundcloud:tracks:123) fails the parse and returns nothing, so
  // strip it down like the soundwave similar-block does.
  const diveSeedId = dive?.urn ? (dive.urn.split(':').pop() ?? dive.urn) : undefined;
  const diveWave = useSmartWave({
    seedKind: 'track',
    seedId: diveSeedId,
    enabled: !!dive,
    limit: 32,
    languages: stableLanguages,
    hideListened,
  });

  const landingTracks = useMemo(() => {
    void dislikeVersion;
    return curateQueueRecommendations(wave.tracks, [], {
      hideLiked,
      hideListened,
      mode: recommendationMode,
      limit: wave.tracks.length,
    });
  }, [wave.tracks, dislikeVersion, hideLiked, hideListened, recommendationMode]);
  const diveTracks = useMemo(() => {
    void dislikeVersion;
    const candidates = dive
      ? (diveWave.data?.tracks ?? []).filter((track) => track.urn !== dive.urn)
      : [];
    return curateQueueRecommendations(candidates, [], {
      hideLiked,
      hideListened,
      mode: recommendationMode,
      limit: candidates.length,
    });
  }, [dive, diveWave.data?.tracks, dislikeVersion, hideLiked, hideListened, recommendationMode]);

  const items = useMemo<WallItem[]>(() => {
    if (dive) return toTiles(diveTracks, 'vibe');
    if (landing) return toTiles(landingTracks, 'wave');
    if (scMode) return toTiles(scTracks.items, 'lexical');
    if (vibeMode) return toTiles(vibe.tracks, 'vibe');
    if (textMode) return weaveText(lex.tracks, lyric.hits, vibe.tracks.slice(0, 8));
    return [];
  }, [
    dive,
    diveTracks,
    landing,
    landingTracks,
    scMode,
    scTracks.items,
    vibeMode,
    vibe.tracks,
    textMode,
    lex.tracks,
    lyric.hits,
  ]);

  const entities = useMemo<EntityItem[]>(() => {
    const out: EntityItem[] = [];
    if (textMode) {
      for (const a of artists.artists.slice(0, 6)) {
        out.push({
          key: `a-${a.id}`,
          label: a.name,
          image: art(a.avatar_url, 't120x120'),
          round: true,
          onClick: () => navigate(`/artist/${a.id}`),
        });
      }
      for (const p of playlists.playlists.slice(0, 6)) {
        out.push({
          key: `p-${p.urn}`,
          label: p.title,
          sub: p.user?.username,
          image: art(p.artwork_url, 't120x120'),
          round: false,
          onClick: () => navigate(`/playlist/${encodeURIComponent(p.urn)}`),
        });
      }
      for (const u of users.users.slice(0, 6)) {
        out.push({
          key: `u-${u.urn}`,
          label: u.username,
          image: art(u.avatar_url, 't120x120'),
          round: true,
          onClick: () => navigate(`/user/${encodeURIComponent(u.urn)}`),
        });
      }
    } else if (scMode) {
      for (const p of scPlaylists.items.slice(0, 6)) {
        out.push({
          key: `scp-${p.urn}`,
          label: p.title,
          sub: p.user?.username,
          image: art(p.artwork_url, 't120x120'),
          round: false,
          onClick: () => navigate(`/playlist/${encodeURIComponent(p.urn)}`),
        });
      }
      for (const u of scUsers.items.slice(0, 6)) {
        out.push({
          key: `scu-${u.urn}`,
          label: u.username,
          image: art(u.avatar_url, 't120x120'),
          round: true,
          onClick: () => navigate(`/user/${encodeURIComponent(u.urn)}`),
        });
      }
    }
    return out;
  }, [
    textMode,
    scMode,
    artists.artists,
    playlists.playlists,
    users.users,
    scPlaylists.items,
    scUsers.items,
    navigate,
  ]);

  const atmosphere = useMemo(() => {
    const top = vibe.atmosphere?.topGenres;
    if (dive || landing || scMode || !top?.length) return { tint: [] as string[], energy: 0.5 };
    return { tint: top.slice(0, 2).map(genreColor), energy: vibeEnergy(top) };
  }, [dive, landing, scMode, vibe.atmosphere?.topGenres]);

  if (dive) {
    return {
      items,
      entities,
      atmosphere,
      preparing: false,
      isLoading: diveWave.isLoading,
      hasMore: false,
      isFetchingMore: false,
      entitiesLoading: false,
      loadMore: () => {},
    };
  }
  if (landing) {
    return {
      items,
      entities,
      atmosphere,
      preparing: false,
      isLoading: wave.isLoading,
      hasMore: wave.hasNextPage,
      isFetchingMore: wave.isFetchingNextPage,
      entitiesLoading: false,
      loadMore: () => void wave.fetchNextPage(),
    };
  }
  if (scMode) {
    return {
      items,
      entities,
      atmosphere,
      preparing: false,
      isLoading: scTracks.isLoading && items.length === 0,
      hasMore: scTracks.hasNextPage,
      isFetchingMore: scTracks.isFetchingNextPage,
      entitiesLoading:
        (scTracks.isLoading || scPlaylists.isLoading || scUsers.isLoading) && entities.length === 0,
      loadMore: () => scTracks.fetchNextPage(),
    };
  }
  if (vibeMode) {
    return {
      items,
      entities,
      atmosphere,
      preparing: vibe.preparing,
      isLoading: vibe.isLoading,
      hasMore: false,
      isFetchingMore: false,
      entitiesLoading: false,
      loadMore: () => {},
    };
  }
  // text mode
  return {
    items,
    entities,
    atmosphere,
    preparing: false,
    isLoading: (lex.isLoading || lyric.isLoading) && items.length === 0,
    hasMore: lex.hasNextPage,
    isFetchingMore: lex.isFetchingNextPage,
    entitiesLoading:
      (!entityQ || artists.isLoading || playlists.isLoading || users.isLoading) &&
      entities.length === 0,
    loadMore: () => lex.fetchNextPage(),
  };
}
