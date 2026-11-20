import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AudioLines, Check, FileText } from '../../../lib/icons';
import type { OwnLyricsInput } from '../../../lib/lyrics';
import {
  canSaveOwnLyrics,
  checkOwnLyrics,
  type OwnLyricsCheck,
  ownLyricsInput,
} from '../../../lib/own-lyrics-text';
import { isMac } from '../../../lib/platform';
import { KeyCaps } from '../../ui/KeyCap';

function selectLine(area: HTMLTextAreaElement, line: number) {
  const rows = area.value.split('\n');
  const start = rows.slice(0, line - 1).reduce((sum, row) => sum + row.length + 1, 0);
  area.focus();
  area.setSelectionRange(start, start + (rows[line - 1]?.length ?? 0));
  const height = Number.parseFloat(getComputedStyle(area).lineHeight) || 20;
  area.scrollTop = Math.max(0, (line - 3) * height);
}

const Problem = ({ check, onLine }: { check: OwnLyricsCheck; onLine: (line: number) => void }) => {
  const { t } = useTranslation();
  const badLine = check.badLine;
  const text = check.tooLong
    ? t('lyricsOwn.tooLong')
    : badLine !== null
      ? t('lyricsOwn.badLine', { line: badLine })
      : check.silent
        ? t('lyricsOwn.silent')
        : null;
  if (!text) return null;
  const body = (
    <>
      <AlertCircle size={13} className="shrink-0" />
      <span className="truncate">{text}</span>
    </>
  );
  return badLine !== null && !check.tooLong ? (
    <button
      type="button"
      onClick={() => onLine(badLine)}
      className="min-w-0 inline-flex items-center gap-1.5 text-[12px] font-medium text-bad hover:underline cursor-pointer"
    >
      {body}
    </button>
  ) : (
    <span className="min-w-0 inline-flex items-center gap-1.5 text-[12px] font-medium text-bad">
      {body}
    </span>
  );
};

const KindMark = ({ check }: { check: OwnLyricsCheck }) => {
  const { t } = useTranslation();
  if (check.kind === 'empty') return null;
  const synced = check.kind === 'synced';
  return (
    <span className="shrink-0 inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold ${
          synced ? 'bg-accent/15 text-accent' : 'bg-ink/[0.06] text-ink-40'
        }`}
      >
        {synced ? <AudioLines size={10} /> : <FileText size={10} />}
        {t(synced ? 'lyricsOwn.synced' : 'lyricsOwn.plain')}
      </span>
      <span className="text-[11px] text-ink-30 tabular-nums">
        {t('lyricsOwn.lines', { count: check.lines })}
      </span>
    </span>
  );
};

export const LyricsPaste = React.memo(
  ({ initial, onSave }: { initial: string; onSave: (input: OwnLyricsInput) => void }) => {
    const { t } = useTranslation();
    const [text, setText] = useState(initial);
    const check = useMemo(() => checkOwnLyrics(text), [text]);
    const ready = canSaveOwnLyrics(check);
    const areaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      areaRef.current?.focus();
      areaRef.current?.select();
    }, []);

    const save = () => {
      if (ready) onSave(ownLyricsInput(text, check));
    };

    return (
      <div data-ui="lyrics-paste" className="flex-1 min-h-0 flex flex-col gap-3 pb-4">
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          placeholder={t('lyricsOwn.pastePlaceholder')}
          aria-label={t('lyricsOwn.pasteTab')}
          aria-invalid={check.kind !== 'empty' && !ready}
          spellCheck={false}
          className="flex-1 min-h-[160px] resize-none rounded-2xl bg-ink/[0.05] border border-ink/[0.08] focus:border-ink/20 px-4 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-30 transition-colors"
        />
        <div className="flex items-center gap-3 min-h-8">
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <KindMark check={check} />
            <Problem
              check={check}
              onLine={(line) => areaRef.current && selectLine(areaRef.current, line)}
            />
          </div>
          <span className="shrink-0 hidden sm:inline-flex">
            <KeyCaps size="sm" labels={[isMac() ? '⌘' : 'Ctrl', '↵']} />
          </span>
          <button
            type="button"
            onClick={save}
            disabled={!ready}
            className="shrink-0 h-8 px-4 flex items-center gap-1.5 rounded-full text-[12px] font-semibold bg-accent text-accent-contrast hover:bg-accent-hover transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent"
          >
            <Check size={13} />
            {t('lyricsOwn.save')}
          </button>
        </div>
      </div>
    );
  },
);
