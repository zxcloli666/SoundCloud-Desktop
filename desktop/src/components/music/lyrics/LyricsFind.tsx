import { keepPreviousData, useQuery } from '@tanstack/react-query';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  AudioLines,
  Check,
  ClipboardPaste,
  FileText,
  Loader2,
  MicVocal,
  RotateCcw,
  Search,
} from '../../../lib/icons';
import type { OwnLyricsInput } from '../../../lib/lyrics';
import { type LyricsCandidate, searchLyricsCandidates } from '../../../lib/own-lyrics';
import {
  canSaveOwnLyrics,
  checkOwnLyrics,
  formatTrackLength,
  lyricsPreview,
} from '../../../lib/own-lyrics-text';
import { getTrackDisplay } from '../../../lib/track-display';
import type { Track } from '../../../stores/player';
import { useDebouncedValue } from '../../discover/useDebouncedValue';
import { Skeleton } from '../../ui/Skeleton';

const MATCH_SECONDS = 3;
const PREVIEW_LINES = 4;

interface Pick {
  candidate: LyricsCandidate;
  input: OwnLyricsInput;
  synced: boolean;
  preview: string[];
}

function toPick(candidate: LyricsCandidate): Pick | null {
  const synced =
    candidate.syncedLrc && canSaveOwnLyrics(checkOwnLyrics(candidate.syncedLrc))
      ? candidate.syncedLrc
      : null;
  const plain = candidate.plainText?.trim() ? candidate.plainText : null;
  if (!synced && !plain) return null;
  return {
    candidate,
    synced: !!synced,
    input: {
      syncedLrc: synced ?? undefined,
      plainText: plain ?? undefined,
      lrclibId: candidate.lrclibId,
    },
    preview: lyricsPreview(synced, plain, PREVIEW_LINES),
  };
}

const primaryButton =
  'h-8 px-4 flex items-center gap-1.5 rounded-full text-[12px] font-semibold bg-accent text-accent-contrast hover:bg-accent-hover transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
const quietButton =
  'h-8 px-4 flex items-center gap-1.5 rounded-full text-[12px] font-semibold text-ink-60 bg-ink/[0.06] hover:bg-ink/[0.12] hover:text-ink transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

const FindState = ({
  icon,
  title,
  hint,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  action: React.ReactNode;
  onAction: () => void;
}) => (
  <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
    {icon}
    <p className="text-[14px] text-ink-50 font-semibold">{title}</p>
    <p className="text-[12px] text-ink-25 leading-relaxed max-w-[300px]">{hint}</p>
    <button type="button" onClick={onAction} className={`${quietButton} mt-2`}>
      {action}
    </button>
  </div>
);

const KindBadge = ({ synced }: { synced: boolean }) => {
  const { t } = useTranslation();
  return synced ? (
    <span className="shrink-0 inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent/15 text-accent text-[10px] font-semibold">
      <AudioLines size={10} />
      {t('lyricsOwn.synced')}
    </span>
  ) : (
    <span className="shrink-0 inline-flex items-center gap-1 h-5 px-2 rounded-full bg-ink/[0.06] text-ink-40 text-[10px] font-semibold">
      <FileText size={10} />
      {t('lyricsOwn.plain')}
    </span>
  );
};

const CandidateRow = React.memo(
  ({
    id,
    pick,
    active,
    current,
    trackSeconds,
    onSelect,
    onUse,
  }: {
    id: string;
    pick: Pick;
    active: boolean;
    current: boolean;
    trackSeconds: number;
    onSelect: () => void;
    onUse: () => void;
  }) => {
    const { t } = useTranslation();
    const { candidate } = pick;
    const length = formatTrackLength(candidate.durationSec);
    const sameLength =
      candidate.durationSec != null &&
      trackSeconds > 0 &&
      Math.abs(candidate.durationSec - trackSeconds) <= MATCH_SECONDS;
    return (
      <div
        id={id}
        role="option"
        tabIndex={-1}
        aria-selected={active}
        data-ui="lyrics-candidate"
        data-state={active ? 'active' : undefined}
        onClick={onSelect}
        onDoubleClick={current ? undefined : onUse}
        className={`rounded-2xl border px-4 py-3 cursor-pointer transition-colors ${
          active ? 'bg-ink/[0.07] border-ink/[0.12]' : 'border-transparent hover:bg-ink/[0.04]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink-90 truncate">{candidate.title}</p>
            <p className="text-[12px] text-ink-40 truncate">
              {candidate.album ? `${candidate.artist} · ${candidate.album}` : candidate.artist}
            </p>
          </div>
          {length && (
            <span
              title={sameLength ? t('lyricsOwn.sameLength') : undefined}
              className={`shrink-0 inline-flex items-center gap-1 text-[11px] tabular-nums ${
                sameLength ? 'text-accent' : 'text-ink-30'
              }`}
            >
              {sameLength && <Check size={11} />}
              {length}
            </span>
          )}
          <KindBadge synced={pick.synced} />
        </div>
        {active && (
          <div className="mt-3 flex items-end gap-3">
            <div className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink-50">
              {pick.preview.map((line, i) => (
                <p key={i} className="truncate">
                  {line}
                </p>
              ))}
            </div>
            {current ? (
              <span className="shrink-0 inline-flex items-center gap-1 h-8 px-3 text-[12px] font-semibold text-ink-40">
                <Check size={13} />
                {t('lyricsOwn.current')}
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUse();
                }}
                className={`${primaryButton} shrink-0`}
              >
                <Check size={13} />
                {t('lyricsOwn.use')}
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
);

const SkeletonRows = () => (
  <div className="flex flex-col gap-2" aria-hidden>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-2.5 w-3/5" />
        </div>
        <Skeleton className="h-5 w-14" rounded="full" />
      </div>
    ))}
  </div>
);

export const LyricsFind = React.memo(
  ({
    track,
    currentId,
    onPick,
    onPaste,
  }: {
    track: Track;
    currentId: number | null;
    onPick: (input: OwnLyricsInput) => void;
    onPaste: () => void;
  }) => {
    const { t } = useTranslation();
    const listId = useId();
    const [query, setQuery] = useState(() => {
      const display = getTrackDisplay(track);
      return `${display.artistLine || track.user.username} ${display.title}`.trim();
    });
    const term = useDebouncedValue(query.trim(), 450);
    const [active, setActive] = useState(0);

    const search = useQuery({
      queryKey: ['lyrics-candidates', term, track.duration],
      queryFn: () => searchLyricsCandidates(term, track.duration),
      enabled: term.length > 0,
      staleTime: 5 * 60_000,
      retry: false,
      placeholderData: keepPreviousData,
    });

    const picks = useMemo(
      () =>
        term ? (search.data ?? []).map(toPick).filter((pick): pick is Pick => pick !== null) : [],
      [term, search.data],
    );
    const shown = Math.min(active, Math.max(0, picks.length - 1));

    useEffect(() => {
      document.getElementById(`${listId}-${shown}`)?.scrollIntoView({ block: 'nearest' });
    }, [listId, shown]);

    const use = (pick: Pick | undefined) => {
      if (pick && pick.candidate.lrclibId !== currentId) onPick(pick.input);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (picks.length === 0) return;
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((shown + step + picks.length) % picks.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        use(picks[shown]);
      }
    };

    const trackSeconds = track.duration > 0 ? track.duration / 1000 : 0;
    const waiting = term.length > 0 && search.isFetching;
    const failed = term.length > 0 && search.isError && !search.isFetching;
    const loading = waiting && picks.length === 0;
    const empty = term.length > 0 && search.isSuccess && !waiting && picks.length === 0;

    return (
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        <label className="flex items-center gap-2.5 h-11 px-4 rounded-2xl bg-ink/[0.05] border border-ink/[0.08] focus-within:border-ink/20 transition-colors">
          {waiting ? (
            <Loader2 size={15} className="shrink-0 animate-spin text-ink-40" />
          ) : (
            <Search size={15} className="shrink-0 text-ink-40" />
          )}
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t('lyricsOwn.query')}
            aria-label={t('lyricsOwn.query')}
            role="combobox"
            aria-expanded={picks.length > 0}
            aria-controls={listId}
            aria-activedescendant={picks.length > 0 ? `${listId}-${shown}` : undefined}
            autoFocus
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-30"
          />
        </label>

        {failed ? (
          <FindState
            icon={<AlertCircle size={28} className="text-bad mb-1" />}
            title={t('lyricsOwn.searchFailed')}
            hint={t('lyricsOwn.searchFailedHint')}
            onAction={() => void search.refetch()}
            action={
              <>
                <RotateCcw size={13} />
                {t('common.retry')}
              </>
            }
          />
        ) : loading ? (
          <SkeletonRows />
        ) : empty ? (
          <FindState
            icon={<MicVocal size={28} className="text-ink-15 mb-1" />}
            title={t('lyricsOwn.nothingFound')}
            hint={t('lyricsOwn.nothingFoundHint')}
            onAction={onPaste}
            action={
              <>
                <ClipboardPaste size={13} />
                {t('lyricsOwn.paste')}
              </>
            }
          />
        ) : (
          <div
            id={listId}
            role="listbox"
            aria-label={t('lyricsOwn.find')}
            className="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-1 pb-4"
          >
            {picks.map((pick, i) => (
              <CandidateRow
                key={pick.candidate.lrclibId}
                id={`${listId}-${i}`}
                pick={pick}
                active={i === shown}
                current={pick.candidate.lrclibId === currentId}
                trackSeconds={trackSeconds}
                onSelect={() => setActive(i)}
                onUse={() => use(pick)}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);
