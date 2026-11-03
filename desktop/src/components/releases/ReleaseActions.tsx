import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ListPlus, Play } from '../../lib/icons';
import { type Track, usePlayerStore } from '../../stores/player';

export function ReleaseActions({ tracks }: { tracks: Track[] }) {
  const { t } = useTranslation();
  const [queued, setQueued] = useState(false);
  if (tracks.length === 0) return null;

  const playAll = () => usePlayerStore.getState().play(tracks[0], tracks);
  const enqueue = () => {
    usePlayerStore.getState().addToQueueEnd(tracks);
    setQueued(true);
    setTimeout(() => setQueued(false), 2200);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={playAll}
        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-accent px-4 text-[12.5px] font-bold text-accent-contrast shadow-[0_6px_20px_-6px_var(--color-accent-glow)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]"
      >
        <Play size={13} fill="currentColor" />
        {t('releases.playAll')}
      </button>
      <button
        type="button"
        onClick={enqueue}
        title={t('releases.addToQueue')}
        aria-label={t('releases.addToQueue')}
        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-ink/[0.1] bg-ink/[0.05] text-ink-70 transition-colors hover:bg-ink/[0.1] hover:text-ink"
      >
        {queued ? <Check size={15} className="text-accent" /> : <ListPlus size={15} />}
      </button>
    </div>
  );
}
