import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, RotateCcw } from '../../../lib/icons';
import type { LyricLine, LyricsSource } from '../../../lib/lyrics';
import { formatLyricsOffset, shiftLyricLines, stepLyricsOffset } from '../../../lib/lyrics-offset';
import { useLyricsOffsetStore } from '../../../stores/lyrics-offset';
import { LyricsSourceBadge, SyncedLyrics } from './SyncedLyrics';

const stepBtn =
  'w-7 h-7 flex items-center justify-center rounded-full text-ink-40 hover:text-ink hover:bg-ink/10 transition-colors cursor-pointer';

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

const OffsetControl = React.memo(({ urn }: { urn: string }) => {
  const { t } = useTranslation();
  const offset = useLyricsOffsetStore((s) => s.offsets[urn] ?? 0);
  const setOffset = useLyricsOffsetStore((s) => s.setOffset);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.code !== 'Comma' && e.code !== 'Period') return;
      const current = useLyricsOffsetStore.getState().offsets[urn] ?? 0;
      setOffset(urn, stepLyricsOffset(current, e.code === 'Period' ? 1 : -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [urn, setOffset]);

  return (
    <div
      data-ui="lyrics-offset"
      className="inline-flex items-center gap-0.5 rounded-full border border-ink/[0.06] bg-ink/[0.04] p-0.5"
    >
      <button
        type="button"
        className={stepBtn}
        aria-label={t('track.lyricsEarlier')}
        title={`${t('track.lyricsEarlier')} (,)`}
        onClick={() => setOffset(urn, stepLyricsOffset(offset, -1))}
      >
        <Minus size={13} />
      </button>
      {offset !== 0 ? (
        <button
          type="button"
          aria-label={t('track.lyricsOffsetReset')}
          title={t('track.lyricsOffsetReset')}
          onClick={() => setOffset(urn, 0)}
          className="group h-6 min-w-[58px] px-2 flex items-center justify-center gap-1 rounded-full bg-accent/15 text-accent text-[11px] font-semibold tabular-nums cursor-pointer transition-colors hover:bg-accent/25"
        >
          <span className="group-hover:hidden">{formatLyricsOffset(offset)}</span>
          <RotateCcw size={12} className="hidden group-hover:block" />
        </button>
      ) : (
        <span className="min-w-[58px] text-center text-[11px] font-semibold tabular-nums text-ink-25">
          0.0 s
        </span>
      )}
      <button
        type="button"
        className={stepBtn}
        aria-label={t('track.lyricsLater')}
        title={`${t('track.lyricsLater')} (.)`}
        onClick={() => setOffset(urn, stepLyricsOffset(offset, 1))}
      >
        <Plus size={13} />
      </button>
    </div>
  );
});

export const OffsetSyncedLyrics = React.memo(
  ({
    urn,
    lines,
    source,
    onSearch,
  }: {
    urn: string;
    lines: LyricLine[];
    source: LyricsSource;
    onSearch: () => void;
  }) => {
    const offset = useLyricsOffsetStore((s) => s.offsets[urn] ?? 0);
    const shifted = useMemo(() => shiftLyricLines(lines, offset), [lines, offset]);
    return (
      <>
        <LyricsSourceBadge source={source} onSearch={onSearch}>
          <OffsetControl urn={urn} />
        </LyricsSourceBadge>
        <SyncedLyrics lines={shifted} />
      </>
    );
  },
);
