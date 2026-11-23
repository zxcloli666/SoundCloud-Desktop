import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ListPlus, Play } from '../../lib/icons';
import { type Track, usePlayerStore } from '../../stores/player';

const LOOKS = {
  loud: {
    row: 'gap-2',
    play: 'h-9 gap-2 bg-accent px-4 text-[12.5px] font-bold text-accent-contrast shadow-[0_6px_20px_-6px_var(--color-accent-glow)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]',
    queue:
      'size-9 border border-ink/[0.1] bg-ink/[0.05] text-ink-70 transition-colors hover:bg-ink/[0.1] hover:text-ink',
    label: '',
    playIcon: 13,
    queueIcon: 15,
  },
  quiet: {
    row: 'gap-1',
    play: 'h-7 min-w-7 justify-center gap-1.5 whitespace-nowrap border border-ink/[0.1] px-2 text-[11.5px] font-semibold text-ink-60 transition-colors hover:bg-ink/[0.07] hover:text-ink @min-[720px]:px-3',
    queue: 'size-7 text-ink-50 transition-colors hover:bg-ink/[0.07] hover:text-ink',
    label: 'hidden @min-[720px]:inline',
    playIcon: 10,
    queueIcon: 14,
  },
};

export function ReleaseActions({ tracks, quiet = false }: { tracks: Track[]; quiet?: boolean }) {
  const { t } = useTranslation();
  const [queued, setQueued] = useState(false);
  if (tracks.length === 0) return null;
  const look = quiet ? LOOKS.quiet : LOOKS.loud;

  const playAll = () => usePlayerStore.getState().play(tracks[0], tracks);
  const enqueue = () => {
    usePlayerStore.getState().addToQueueEnd(tracks);
    setQueued(true);
    setTimeout(() => setQueued(false), 2200);
  };

  return (
    <div className={`flex items-center ${look.row}`}>
      <button
        type="button"
        onClick={playAll}
        title={t('releases.playAll')}
        aria-label={t('releases.playAll')}
        className={`inline-flex cursor-pointer items-center rounded-full ${look.play}`}
      >
        <Play size={look.playIcon} fill="currentColor" />
        <span className={look.label}>{t('releases.playAll')}</span>
      </button>
      <button
        type="button"
        onClick={enqueue}
        title={t('releases.addToQueue')}
        aria-label={t('releases.addToQueue')}
        className={`inline-flex cursor-pointer items-center justify-center rounded-full ${look.queue}`}
      >
        {queued ? (
          <Check size={look.queueIcon} className="text-accent" />
        ) : (
          <ListPlus size={look.queueIcon} />
        )}
      </button>
    </div>
  );
}
