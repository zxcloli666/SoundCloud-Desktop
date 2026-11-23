import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { stopHoverPreview, wirePreviewGuards } from '../../lib/audioPreview';
import { useDiscoverFeed } from '../../lib/hooks';
import { Compass, Shuffle } from '../../lib/icons';
import type { Track } from '../../stores/player';
import { genreColor, hashStr, isHeroUrn, WALL_KEYFRAMES, type WallItem } from '../search/utils';
import { useTabHidden, Wall } from '../search/Wall';
import { PrismBand, type PrismSegment } from './PrismBand';

const TRACK_CAP = 24;

function seededOrder(items: Track[], seed: number): Track[] {
  if (seed === 0) return items;
  const a = items.slice();
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const DiscoverPrism = memo(function DiscoverPrism() {
  const { t } = useTranslation();
  const { likedTracks, byGenre: discoverData } = useDiscoverFeed();

  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const genres = useMemo(() => discoverData.map((d) => d.genre), [discoverData]);
  const selectedGenre =
    activeGenre && genres.includes(activeGenre) ? activeGenre : (genres[0] ?? null);

  const segments = useMemo<PrismSegment[]>(() => {
    const counts = new Map<string, number>();
    for (const tr of likedTracks) {
      const g = tr.genre?.trim().toLowerCase();
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    const raw = genres.map((g) => ({ genre: g, count: Math.max(counts.get(g) ?? 1, 1) }));
    const total = raw.reduce((sum, r) => sum + r.count, 0) || 1;
    return raw.map((r) => ({ genre: r.genre, share: r.count / total, color: genreColor(r.genre) }));
  }, [genres, likedTracks]);

  const rawTracks = useMemo(
    () => discoverData.find((d) => d.genre === selectedGenre)?.tracks ?? [],
    [discoverData, selectedGenre],
  );
  const items = useMemo<WallItem[]>(() => {
    const seed = nonce === 0 ? 0 : hashStr(`${selectedGenre}:${nonce}`);
    return seededOrder(rawTracks, seed)
      .filter((tr) => tr?.urn)
      .slice(0, TRACK_CAP)
      .map((track) => ({ track, kind: 'wave' as const, hero: isHeroUrn(track.urn) }));
  }, [rawTracks, selectedGenre, nonce]);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const getQueue = useCallback(() => itemsRef.current.map((i) => i.track), []);

  const hidden = useTabHidden();

  useEffect(() => {
    wirePreviewGuards();
    return () => stopHoverPreview();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: react only to genre changes
  useEffect(() => {
    stopHoverPreview();
    setNonce(0);
  }, [selectedGenre]);

  if (genres.length === 0) return null;

  return (
    <section className="relative" data-tg-hidden={hidden ? '1' : '0'}>
      <style>{WALL_KEYFRAMES}</style>

      <div className="mb-4 flex items-center gap-2.5 px-1">
        <Compass size={16} className="shrink-0 text-ink-55" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold leading-tight tracking-tight text-ink-90">
            {t('discover.prismTitle')}
          </h2>
          <p className="truncate text-[12px] text-ink-40">{t('discover.prismSubtitle')}</p>
        </div>
        <ReshuffleButton
          onClick={() => setNonce((n) => n + 1)}
          label={t('discover.prismShuffle')}
        />
      </div>

      <div className="mb-4 px-1">
        <PrismBand segments={segments} active={selectedGenre ?? ''} onSelect={setActiveGenre} />
      </div>

      <div className="panel relative overflow-hidden p-2 md:p-4" style={{ isolation: 'isolate' }}>
        <Wall items={items} getQueue={getQueue} isLoading={false} />
      </div>
    </section>
  );
});

const ReshuffleButton = memo(function ReshuffleButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  const [turns, setTurns] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        setTurns((x) => x + 1);
        onClick();
      }}
      aria-label={label}
      title={label}
      className="chip-pill shrink-0"
    >
      <Shuffle
        size={13}
        className="transition-transform duration-500 ease-[var(--ease-apple)]"
        style={{ transform: `rotate(${turns * 180}deg)` }}
      />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
});
