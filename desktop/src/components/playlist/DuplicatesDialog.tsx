import * as Dialog from '@radix-ui/react-dialog';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { art, dur } from '../../lib/formatters';
import { Check, CircleCheck, Copy, musicIcon12, X } from '../../lib/icons';
import { findDuplicates } from '../../lib/playlist-duplicates';
import type { Track } from '../../stores/player';

function Cover({ track }: { track: Track }) {
  const cover = art(track.artwork_url, 't200x200');
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink/[0.04] ring-1 ring-ink/[0.06]">
      {cover ? (
        <img src={cover} alt="" className="h-full w-full object-cover" decoding="async" />
      ) : (
        musicIcon12
      )}
    </div>
  );
}

function Line({ track }: { track: Track }) {
  return (
    <>
      <Cover track={track} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink-90">{track.title}</p>
        <p className="truncate text-[11.5px] text-ink-45">{track.user.username}</p>
      </div>
      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-ink-30">
        {dur(track.duration)}
      </span>
    </>
  );
}

function Body({
  tracks,
  onClose,
  onRemove,
}: {
  tracks: Track[];
  onClose: () => void;
  onRemove: (indices: Set<number>) => void;
}) {
  const { t } = useTranslation();
  const groups = useMemo(() => findDuplicates(tracks), [tracks]);
  const [kept, setKept] = useState<Set<number>>(new Set());

  const toggle = (index: number) =>
    setKept((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  const removed = new Set(
    groups.flatMap((g) => g.copies.map((c) => c.index)).filter((index) => !kept.has(index)),
  );

  const confirm = () => {
    onClose();
    onRemove(removed);
  };

  return (
    <>
      <div className="flex items-center gap-3 p-5 pb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Copy size={18} />
        </div>
        <Dialog.Title className="text-[15px] font-bold text-ink-90">
          {t('playlist.dupes')}
        </Dialog.Title>
        <Dialog.Description className="sr-only">{t('playlist.dupesHint')}</Dialog.Description>
        <Dialog.Close
          aria-label={t('common.close')}
          className="ml-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-ink-30 transition-all hover:bg-ink/[0.08] hover:text-ink-70"
        >
          <X size={14} />
        </Dialog.Close>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 pb-8 pt-6 text-center">
          <CircleCheck size={32} className="text-emerald-400" />
          <p className="text-[13px] text-ink-50">{t('playlist.dupesNone')}</p>
          <Dialog.Close className="mt-1 cursor-pointer rounded-xl px-4 py-2 text-[13px] font-medium text-ink-60 transition-all hover:bg-ink/[0.06] hover:text-ink-90">
            {t('common.close')}
          </Dialog.Close>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
            {groups.map((group) => (
              <div
                key={group.copies[0].index}
                className="rounded-2xl bg-ink/[0.03] p-1.5 ring-1 ring-ink/[0.05]"
              >
                <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                  <Line track={group.keep} />
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
                    title={t('playlist.dupesKeep')}
                  >
                    <Check size={13} />
                  </span>
                </div>
                {group.copies.map(({ index, track, sameTrack }) => {
                  const on = !kept.has(index);
                  return (
                    <button
                      key={index}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(index)}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-all duration-200 ${
                        on ? 'bg-red-500/[0.07]' : 'opacity-50 hover:opacity-80'
                      }`}
                    >
                      <Line track={track} />
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-ink-35">
                        {sameTrack ? t('playlist.dupesSame') : t('playlist.dupesSimilar')}
                      </span>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                          on
                            ? 'border-red-400/40 bg-red-500/20 text-red-300'
                            : 'border-ink/[0.15] text-transparent'
                        }`}
                      >
                        <Check size={13} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2.5 p-4 pt-2">
            <Dialog.Close className="cursor-pointer rounded-xl px-4 py-2 text-[13px] font-medium text-ink-50 transition-all hover:bg-ink/[0.06] hover:text-ink-80">
              {t('common.cancel')}
            </Dialog.Close>
            <button
              type="button"
              onClick={confirm}
              disabled={removed.size === 0}
              className="cursor-pointer rounded-xl border border-red-500/20 bg-red-500/15 px-4 py-2 text-[13px] font-semibold tabular-nums text-red-400 transition-all hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('playlist.dupesRemove', { count: removed.size })}
            </button>
          </div>
        </>
      )}
    </>
  );
}

export function DuplicatesDialog({
  open,
  onOpenChange,
  tracks,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tracks: Track[];
  onRemove: (indices: Set<number>) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-shade-60 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl glass border border-ink/[0.08] shadow-2xl animate-fade-in-up">
          <Body tracks={tracks} onClose={() => onOpenChange(false)} onRemove={onRemove} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
