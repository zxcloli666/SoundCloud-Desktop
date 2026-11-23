import { useTranslation } from 'react-i18next';
import { useDisplayTitle } from '../../../lib/track-display';
import { type Track, usePlayerStore } from '../../../stores/player';
import { RowCover } from './RowBody';

function NowText({ track }: { track: Track }) {
  const title = useDisplayTitle(track);
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13.5px] font-semibold leading-tight text-ink">
        {title}
      </span>
      <span className="mt-1 block truncate text-[12px] leading-tight text-ink-50">
        {track.user?.username}
      </span>
    </span>
  );
}

export function HeaderNow({ onTop }: { onTop: () => void }) {
  const { t } = useTranslation();
  const track = usePlayerStore((s) => s.currentTrack);
  const playing = usePlayerStore((s) => s.isPlaying);
  if (!track) return null;
  return (
    <button
      type="button"
      aria-label={t('player.nowPlaying')}
      onClick={onTop}
      className="flex h-full w-full min-w-0 cursor-pointer items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <RowCover track={track} now playing={playing} hover={false} />
      <NowText track={track} />
    </button>
  );
}
