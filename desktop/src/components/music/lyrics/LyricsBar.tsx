import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Pencil, RotateCcw, User, WifiOff } from '../../../lib/icons';
import type { LyricsResult, LyricsSource } from '../../../lib/lyrics';
import { removeOwnLyrics } from '../../../lib/own-lyrics';

const SOURCE_LABELS: Record<LyricsSource, string> = {
  lrclib: 'LRCLib',
  musixmatch: 'Musixmatch',
  genius: 'Genius',
  netease: 'NetEase',
  self_gen: 'AI',
  user: '',
  none: '',
};

const barButton =
  'h-8 px-2.5 flex items-center gap-1.5 rounded-full text-[11px] font-semibold text-ink-30 hover:text-ink-80 hover:bg-ink/10 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-default disabled:opacity-60';

const SourceMark = ({ lyrics }: { lyrics: LyricsResult }) => {
  const { t } = useTranslation();
  if (lyrics.own) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          data-ui="lyrics-own"
          title={t('lyricsOwn.yoursHint')}
          className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent/15 text-accent text-[10px] font-semibold"
        >
          <User size={10} />
          {t('lyricsOwn.yours')}
          {lyrics.lrclibId ? <span className="opacity-60">· LRCLib</span> : null}
        </span>
        {lyrics.unsynced && (
          <span
            role="img"
            aria-label={t('lyricsOwn.unsynced')}
            title={t('lyricsOwn.unsynced')}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-ink/[0.06] text-ink-40"
          >
            <WifiOff size={10} />
          </span>
        )}
      </span>
    );
  }
  const label =
    lyrics.source === 'self_gen' ? t('track.selfGenerated') : SOURCE_LABELS[lyrics.source];
  if (!label) return <span />;
  return (
    <span className="text-[10px] font-semibold text-ink-20 bg-ink/[0.04] px-2 py-0.5 rounded-full border border-ink/[0.06]">
      {label}
    </span>
  );
};

export const LyricsBar = React.memo(
  ({
    urn,
    lyrics,
    onEdit,
    children,
  }: {
    urn: string;
    lyrics: LyricsResult;
    onEdit: () => void;
    children?: React.ReactNode;
  }) => {
    const { t } = useTranslation();
    const [resetting, setResetting] = useState(false);

    const reset = () => {
      setResetting(true);
      removeOwnLyrics(urn)
        .catch(() => undefined)
        .finally(() => setResetting(false));
    };

    return (
      <div className="flex items-center justify-between gap-2 px-12 pt-3 pb-0">
        <SourceMark lyrics={lyrics} />
        {children}
        <div className="flex items-center gap-0.5">
          {lyrics.own && (
            <button
              type="button"
              onClick={reset}
              disabled={resetting}
              title={t('lyricsOwn.automaticHint')}
              className={barButton}
            >
              {resetting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              {t('lyricsOwn.automatic')}
            </button>
          )}
          <button type="button" onClick={onEdit} className={barButton}>
            <Pencil size={13} />
            {t('lyricsOwn.edit')}
          </button>
        </div>
      </div>
    );
  },
);
