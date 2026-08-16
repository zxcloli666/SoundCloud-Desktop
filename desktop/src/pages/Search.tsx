import { ArrowLeft, Cloud, Compass, Sparkles, Type } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebouncedValue } from '../components/discover/useDebouncedValue';
import { EmptyState } from '../components/search/EmptyState';
import { EntityStrip } from '../components/search/EntityStrip';
import { GenreTicker } from '../components/search/GenreTicker';
import { ResolveCard } from '../components/search/ResolveCard';
import { SearchControls } from '../components/search/SearchControls';
import { type DiveSeed, useSearchWall } from '../components/search/useSearchWall';
import {
  GENRES,
  type GenreChip,
  genreColor,
  isSoundCloudUrl,
  WALL_KEYFRAMES,
} from '../components/search/utils';
import { useTabHidden, Wall } from '../components/search/Wall';
import { stopHoverPreview, wirePreviewGuards } from '../lib/audioPreview';
import type { Track } from '../stores/player';
import { useSearchHistoryStore } from '../stores/searchHistory';
import { useSearchPrefsStore } from '../stores/searchPrefs';
import { useSearchQueryStore } from '../stores/searchQuery';

/* The Search page IS the wall — a living mosaic of covers that breathes the vibe
 * of what's on it. The query comes from the global header field (shared store),
 * so there's a single search input app-wide. This page renders the controls,
 * genre ribbon, atmosphere and the wall driven by that query. */
export function Search() {
  const { t } = useTranslation();

  const q = useSearchQueryStore((s) => s.q);
  const setQ = useSearchQueryStore((s) => s.setQ);
  const debounced = useDebouncedValue(q, 350);
  const [dive, setDive] = useState<DiveSeed | null>(null);

  const mode = useSearchPrefsStore((s) => s.mode);
  const setMode = useSearchPrefsStore((s) => s.setMode);
  const source = useSearchPrefsStore((s) => s.source);
  const setSource = useSearchPrefsStore((s) => s.setSource);
  const addQuery = useSearchHistoryStore((s) => s.addQuery);

  const isUrl = isSoundCloudUrl(q);
  const query = isUrl ? '' : debounced;
  const hasQuery = query.trim().length >= 2;
  const hidden = useTabHidden();

  // Stop any active sample on unmount (in-app navigation away from /search) —
  // mouse-leave doesn't fire on a route change, so without this audio leaks.
  useEffect(() => {
    wirePreviewGuards();
    return () => stopHoverPreview();
  }, []);

  // A fresh query (typed in the header) leaves any rabbit-hole dive.
  // biome-ignore lint/correctness/useExhaustiveDependencies: react only to q changes
  useEffect(() => {
    setDive(null);
  }, [q]);

  useEffect(() => {
    const trimmed = debounced.trim();
    if (trimmed.length >= 2 && !isSoundCloudUrl(trimmed)) addQuery(trimmed);
  }, [debounced, addQuery]);

  const wall = useSearchWall(query, mode, source, dive);

  // Play queue is read lazily at play time (see useTrackPlay/CoverTile): a fresh
  // array each append would defeat every tile's memo. Keep a ref + stable thunk.
  const itemsRef = useRef(wall.items);
  itemsRef.current = wall.items;
  const getQueue = useCallback(() => itemsRef.current.map((i) => i.track), []);

  // Genre ribbon reflects what's actually on the wall (top genres present),
  // falling back to the curated set when too few tracks are tagged. Keyed on the
  // ordered top-genre labels so a same-set page append doesn't re-render the
  // marquee (rebuilding ~56 chips) for nothing.
  const topGenres = useMemo<string[]>(() => {
    const counts = new Map<string, number>();
    for (const it of wall.items) {
      const g = it.track.genre?.trim();
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([g]) => g);
  }, [wall.items]);
  // Joined into a stable string key purely for the memo dependency below.
  const topGenreKey = topGenres.join('|');
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on stable label string
  const tickerGenres = useMemo<GenreChip[]>(() => {
    if (topGenres.length < 4) return GENRES;
    return topGenres.map((g) => ({ key: g, label: g, color: genreColor(g) }));
  }, [topGenreKey]);

  const seedGenre = (g: string) => {
    setMode('vibe');
    setSource('db');
    setQ(g);
  };
  const onDive = (track: Track) => setDive({ urn: track.urn, title: track.title });

  // The wall would otherwise paint blank here (cold board, empty result, dive
  // with no neighbors, or a failed request). Show an inviting plaque instead.
  const wallEmpty = !wall.isLoading && wall.items.length === 0;
  const empty = useMemo(() => {
    // Vector still encoding on the worker (high load) — not "no results".
    if (wall.preparing)
      return {
        icon: <Sparkles size={26} className="animate-pulse" />,
        title: t('search.preparingTitle'),
        body: t('search.preparingBody'),
      };
    if (dive)
      return {
        icon: <Compass size={26} />,
        title: t('search.diveEmpty', { title: dive.title }),
        body: t('search.diveEmptyBody'),
        cta: t('search.back'),
        ctaIcon: <ArrowLeft size={15} />,
        onAction: () => setDive(null),
      };
    if (!hasQuery)
      return {
        icon: <Sparkles size={26} />,
        title: t('search.firstTimeTitle'),
        body: t('search.firstTimeBody'),
      };
    if (source === 'sc')
      return {
        icon: <Cloud size={26} />,
        title: t('search.empty.scTitle'),
        body: t('search.empty.scBody', { query: query.trim() }),
      };
    if (mode === 'text')
      return {
        icon: <Sparkles size={26} />,
        title: t('search.empty.toVibeTitle'),
        body: t('search.empty.toVibeBody'),
        cta: t('search.empty.toVibeCta'),
        ctaIcon: <Sparkles size={15} />,
        onAction: () => setMode('vibe'),
      };
    return {
      icon: <Type size={26} />,
      title: t('search.empty.toTextTitle'),
      body: t('search.empty.toTextBody'),
      cta: t('search.empty.toTextCta'),
      ctaIcon: <Type size={15} />,
      onAction: () => setMode('text'),
    };
  }, [wall.preparing, dive, hasQuery, mode, source, query, t, setMode]);

  return (
    <div className="sonveil-section-page sonveil-search-page" data-tg-hidden={hidden ? '1' : '0'}>
      <style>{WALL_KEYFRAMES}</style>

      <div className="sonveil-search-content" style={{ isolation: 'isolate' }}>
        <header className="sonveil-page-header sonveil-search-heading">
          <div>
            <h1>{t('nav.search')}</h1>
          </div>
        </header>
        {isUrl ? (
          <ResolveCard url={q} onDone={() => setQ('')} />
        ) : (
          <>
            {hasQuery && !dive && (
              <div className="flex justify-center px-4 mb-3">
                <SearchControls />
              </div>
            )}

            <div className="mb-1">
              {dive ? (
                <div className="flex justify-center px-4">
                  <button
                    type="button"
                    onClick={() => setDive(null)}
                    className="inline-flex items-center gap-2 h-8 pl-2.5 pr-4 rounded-full text-[12px] text-white/70 hover:text-white transition-colors cursor-pointer"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '0.5px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <ArrowLeft size={14} />
                    {t('search.diveFrom', { title: dive.title })}
                  </button>
                </div>
              ) : (
                <GenreTicker genres={tickerGenres} onSelect={seedGenre} />
              )}
            </div>

            {wall.entities.length > 0 ? (
              <div className="mb-2 max-w-[1100px] mx-auto w-full">
                <EntityStrip items={wall.entities} />
              </div>
            ) : wall.entitiesLoading ? (
              <div className="mb-2 max-w-[1100px] mx-auto w-full px-4 flex gap-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={`ent-sk-${i}`}
                    className="h-11 w-32 shrink-0 rounded-full skeleton-shimmer"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  />
                ))}
              </div>
            ) : null}

            {wallEmpty ? (
              <EmptyState
                icon={empty.icon}
                title={empty.title}
                body={empty.body}
                cta={empty.cta}
                ctaIcon={empty.ctaIcon}
                onAction={empty.onAction}
              />
            ) : (
              <Wall
                items={wall.items}
                getQueue={getQueue}
                isLoading={wall.isLoading}
                hasMore={wall.hasMore}
                isFetchingMore={wall.isFetchingMore}
                onLoadMore={wall.loadMore}
                onDive={onDive}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
