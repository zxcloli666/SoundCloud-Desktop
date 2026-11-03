import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { Disc3 } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { usePlayerStore } from '../../../stores/player';
import '../embeds/vinyl.css';

export const NowPlayingButton = memo(function NowPlayingButton({
  onAttach,
}: {
  onAttach: () => void;
}) {
  const { t } = useTranslation();
  const track = usePlayerStore((state) => state.currentTrack);
  const playing = usePlayerStore((state) => state.isPlaying);
  const spin = usePerfMode().idleAnim && playing;
  const cover = art(track?.artwork_url ?? track?.user.avatar_url, 't67x67');
  const label = track
    ? t('chat.thread.composer.nowPlaying', { title: track.title })
    : t('chat.thread.composer.nothingPlaying');

  return (
    <button
      type="button"
      disabled={!track}
      aria-label={label}
      title={label}
      onClick={onAttach}
      className="group/disc relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform duration-200 hover:scale-105 disabled:cursor-default disabled:hover:scale-100"
    >
      {track && cover ? (
        <span
          className="chat-thread-motion relative size-[30px] overflow-hidden rounded-full border border-ink/15"
          style={{ animation: spin ? 'chat-thread-spin 6s linear infinite' : undefined }}
        >
          <img src={cover} alt="" className="size-full object-cover" />
          <span aria-hidden className="chat-vinyl-label absolute inset-0 rounded-full" />
        </span>
      ) : (
        <Disc3 size={19} className={track ? 'text-ink-70' : 'text-ink-25'} />
      )}
      {playing && (
        <span
          aria-hidden
          className="absolute right-0.5 bottom-0.5 size-2 rounded-full border border-black/60"
          style={{ background: 'var(--color-accent)' }}
        />
      )}
    </button>
  );
});
