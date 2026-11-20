import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardPaste, Search, X } from '../../../lib/icons';
import type { LyricsResult, OwnLyricsInput } from '../../../lib/lyrics';
import { saveOwnLyrics } from '../../../lib/own-lyrics';
import type { Track } from '../../../stores/player';
import { LyricsFind } from './LyricsFind';
import { LyricsPaste } from './LyricsPaste';

export type AttachTab = 'find' | 'paste';

const TABS = [
  { id: 'find', label: 'lyricsOwn.findTab', Icon: Search },
  { id: 'paste', label: 'lyricsOwn.pasteTab', Icon: ClipboardPaste },
] as const;

export const LyricsAttach = React.memo(
  ({
    track,
    lyrics,
    tab,
    onTab,
    onClose,
  }: {
    track: Track;
    lyrics: LyricsResult | null;
    tab: AttachTab;
    onTab: (tab: AttachTab) => void;
    onClose: () => void;
  }) => {
    const { t } = useTranslation();

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onClose();
      };
      window.addEventListener('keydown', onKey, true);
      return () => window.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    const save = (input: OwnLyricsInput) => {
      void saveOwnLyrics(track.urn, input);
      onClose();
    };

    return (
      <div
        data-ui="lyrics-attach"
        role="dialog"
        aria-label={t('lyricsOwn.title')}
        className="flex-1 min-h-0 flex flex-col px-8 pt-3 motion-safe:animate-[fadeInUp_0.3s_var(--ease-apple)_both]"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div
            role="tablist"
            className="inline-flex items-center gap-0.5 rounded-full border border-ink/[0.06] bg-ink/[0.04] p-0.5"
          >
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => onTab(id)}
                className={`h-7 px-3 flex items-center gap-1.5 rounded-full text-[12px] font-semibold transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                  tab === id ? 'bg-ink/[0.12] text-ink' : 'text-ink-40 hover:text-ink-80'
                }`}
              >
                <Icon size={13} />
                {t(label)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            title={`${t('common.close')} (Esc)`}
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-30 hover:text-ink-80 hover:bg-ink/10 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <X size={15} />
          </button>
        </div>
        {tab === 'find' ? (
          <LyricsFind
            track={track}
            currentId={lyrics?.own ? lyrics.lrclibId : null}
            onPick={save}
            onPaste={() => onTab('paste')}
          />
        ) : (
          <LyricsPaste initial={lyrics?.lrc || lyrics?.plain || ''} onSave={save} />
        )}
      </div>
    );
  },
);
