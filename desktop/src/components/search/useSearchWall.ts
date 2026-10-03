import {useQueryClient} from '@tanstack/react-query';
import {useCallback, useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import {art} from '../../lib/formatters';
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
import type {LiveMeta, LiveState} from '../../lib/search/live';
import {useSmartWave, useWaveBoard} from '../../lib/soundwave';
import type {Track} from '../../stores/player';
import type {SearchMode, SearchSource} from '../../stores/searchPrefs';
import {useSettingsStore} from '../../stores/settings';
import {useDebouncedValue} from '../discover/useDebouncedValue';
import type {EntityItem} from './EntityStrip';
import {useStableOrder} from './useStableOrder';
import {genreColor, trackKey, vibeEnergy, type WallItem} from './utils';
import {appendLiveOnly, mergeLive, toTiles, weaveText} from './weave';

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
  vibeUnavailable: boolean;
  isError: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  entitiesLoading: boolean;
  loadMore: () => void;
  retry: () => void;
  dimmed: boolean;
  live: WallLive;
  retryLive: () => void;
  wallRef: (el: HTMLElement | null) => void;
}

export type WallLiveState = LiveState | 'searching' | 'idle';

export interface WallLive {
  state: WallLiveState;
  added: number;
  retryAfter?: number;
}

interface LiveFeed {
  isLoading: boolean;
  isError: boolean;
  isPlaceholderData: boolean;
  live?: LiveMeta;
}

function liveStateOf(feed: LiveFeed, active: boolean, pending: boolean): WallLiveState {
  if (!active) return pending ? 'searching' : 'idle';
  if (feed.isLoading || feed.isPlaceholderData) return 'searching';
  if (feed.isError) return 'unavailable';
  return feed.live?.state ?? 'idle';
}

const MIN_LEN = 2;
const LIVE_DEBOUNCE_MS = 650;
const FILL_BELOW = 6;
const NO_TRACKS: Track[] = [];

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
  const queryClient = useQueryClient();
  const trimmed = query.trim();
  const hasQuery = trimmed.length >= MIN_LEN;
  const db = source === 'db';
  const landing = !hasQuery && !dive;
  const scMode = hasQuery && source === 'sc' && !dive;
  const textMode = hasQuery && mode === 'text' && db && !dive;
  const vibeMode = hasQuery && mode === 'vibe' && db && !dive;

  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const wave = useWaveBoard({ enabled: landing, hideListened });
  const vibeQ = vibeMode || textMode ? trimmed : '';
  // Text mode only needs a pinch of vibe tiles (+ a genre sample for atmosphere),
  // so cap it small instead of the full 48 used in dedicated vibe mode.
  const vibe = useVibeSearch(vibeQ, textMode ? { limit: 12 } : undefined);
  const lex = useSearchDbTracks(textMode || scMode ? trimmed : '');
  const lyric = useLyricSearch(textMode ? trimmed : '', 'auto');
  const artists = useSearchDbArtists(textMode ? trimmed : '');
  const users = useSearchDbUsers(textMode ? trimmed : '');
  const playlists = useSearchDbPlaylists(textMode ? trimmed : '');

  const liveQ = useDebouncedValue(scMode ? trimmed : '', LIVE_DEBOUNCE_MS);
  const scActive = scMode && liveQ === trimmed;
  const scTracks = useSearchTracks(liveQ, 'sc');
  const scPlaylists = useSearchPlaylists(liveQ, 'sc');
  const scUsers = useSearchUsers(liveQ, 'sc');

  const lexSettled = lex.isFetched && !lex.isPlaceholderData && !lex.isLoading;
  const wantsFill = textMode && lexSettled && (lex.weak ?? lex.tracks.length < FILL_BELOW);
  const fillQ = useDebouncedValue(wantsFill ? trimmed : '', LIVE_DEBOUNCE_MS);
  const fillActive = textMode && fillQ !== '' && fillQ === trimmed;
  const fill = useSearchTracks(fillQ, 'fill');

  // The wave/from-track endpoint parses the path segment as a bare numeric id;
  // a full URN (soundcloud:tracks:123) fails the parse and returns nothing, so
  // strip it down like the soundwave similar-block does.
  const diveSeedId = dive?.urn ? (dive.urn.split(':').pop() ?? dive.urn) : undefined;
  const diveWave = useSmartWave({
    seedKind: 'track',
    seedId: diveSeedId,
    enabled: !!dive,
    limit: 32,
    hideListened,
  });

  const dimmed = (scMode || textMode) && lex.isPlaceholderData;
  const scLive = scActive && !scTracks.isPlaceholderData ? scTracks.items : NO_TRACKS;
  const fillLive = fillActive && !fill.isPlaceholderData ? fill.items : NO_TRACKS;

  const searchTiles = useMemo<WallItem[]>(() => {
    if (scMode) return mergeLive(scLive, lex.tracks);
    if (textMode) {
      return appendLiveOnly(weaveText(lex.tracks, lyric.hits, vibe.tracks.slice(0, 8)), fillLive);
    }
    return [];
  }, [scMode, scLive, textMode, lex.tracks, lyric.hits, vibe.tracks, fillLive]);

  const orderKey = `${mode}|${source}|${trimmed}|${dimmed ? 'previous' : 'current'}`;
  const { list: ordered, wallRef } = useStableOrder(searchTiles, trackKey, orderKey);

  const items = useMemo<WallItem[]>(() => {
    if (dive) return toTiles(diveWave.data?.tracks ?? [], 'vibe');
    if (landing) return toTiles(wave.tracks, 'wave');
    if (scMode || textMode) return ordered;
    if (vibeMode) return toTiles(vibe.tracks, 'vibe');
    return [];
  }, [
    dive,
    diveWave.data?.tracks,
    landing,
    wave.tracks,
    scMode,
    textMode,
    ordered,
    vibeMode,
    vibe.tracks,
  ]);

  const liveFeed = scMode ? scTracks : fill;
  const livePending = scMode ? !scActive : wantsFill && !fillActive;
  const liveState = liveStateOf(liveFeed, scMode ? scActive : fillActive, livePending);
  const added = useMemo(() => items.filter((item) => item.live).length, [items]);
  const live: WallLive = {
    state: liveState,
    added,
    retryAfter: liveFeed.live?.retry_after_sec ?? undefined,
  };
  const liveWaiting = liveState === 'searching';

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

  const retry = useCallback(
    () =>
      void queryClient.refetchQueries({
        queryKey: ['search'],
        type: 'active',
        predicate: (q) => q.state.status === 'error',
      }),
    [queryClient],
  );

  const refetchSc = scTracks.refetch;
  const refetchFill = fill.refetch;
  const retryLive = useCallback(() => {
    if (scActive) void refetchSc();
    else if (fillActive) void refetchFill();
  }, [scActive, fillActive, refetchSc, refetchFill]);

  const base = { items, entities, atmosphere, dimmed: false, live, retry, retryLive, wallRef };

  if (dive) {
    return {
      ...base,
      preparing: false,
      vibeUnavailable: false,
      isError: false,
      isLoading: diveWave.isLoading,
      hasMore: false,
      isFetchingMore: false,
      entitiesLoading: false,
      loadMore: () => {},
    };
  }
  if (landing) {
    return {
      ...base,
      preparing: false,
      vibeUnavailable: false,
      isError: false,
      isLoading: wave.isLoading,
      hasMore: wave.hasNextPage,
      isFetchingMore: wave.isFetchingNextPage,
      entitiesLoading: false,
      loadMore: () => void wave.fetchNextPage(),
    };
  }
  if (scMode) {
    return {
      ...base,
      dimmed,
      preparing: false,
      vibeUnavailable: false,
      isError: lex.isError && scActive && scTracks.isError && items.length === 0,
      isLoading: (lex.isLoading || liveWaiting) && items.length === 0,
      hasMore: !dimmed && scActive && scTracks.hasNextPage,
      isFetchingMore: scTracks.isFetchingNextPage,
      entitiesLoading: (scPlaylists.isLoading || scUsers.isLoading) && entities.length === 0,
      loadMore: () => void scTracks.fetchNextPage(),
    };
  }
  if (vibeMode) {
    return {
      ...base,
      preparing: vibe.preparing,
      vibeUnavailable: vibe.unavailable,
      isError: vibe.isError && items.length === 0,
      isLoading: vibe.isLoading,
      hasMore: false,
      isFetchingMore: false,
      entitiesLoading: false,
      loadMore: () => {},
    };
  }
  const fillMore = !lex.hasNextPage && fillActive && fill.hasNextPage;
  return {
    ...base,
    dimmed,
    preparing: false,
    vibeUnavailable: false,
    isError: lex.isError && items.length === 0 && !liveWaiting && (!fillActive || fill.isError),
    isLoading: (lex.isLoading || lyric.isLoading || liveWaiting) && items.length === 0,
    hasMore: !dimmed && (lex.hasNextPage || fillMore),
    isFetchingMore: lex.isFetchingNextPage || fill.isFetchingNextPage,
    entitiesLoading:
      (artists.isLoading || playlists.isLoading || users.isLoading) && entities.length === 0,
    loadMore: () => void (fillMore ? fill.fetchNextPage() : lex.fetchNextPage()),
  };
}
