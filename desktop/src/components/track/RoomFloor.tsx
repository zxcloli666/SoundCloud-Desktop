import React, { useEffect, useRef } from 'react';
import { usePlayingCopy } from '../../lib/alt-upload';
import { getCurrentTime, subscribe } from '../../lib/audio';
import { durLong } from '../../lib/formatters';
import type { Comment } from '../../lib/hooks';
import type { Track } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';
import { LiveWaveform } from '../music/soundwave/waveform';
import { MomentMarks } from './MomentMarks';
import { WaveVoices } from './WaveVoices';

export const RoomFloor = React.memo(function RoomFloor({
  track,
  isCurrent,
  comments,
  onSeek,
}: {
  track: Track;
  isCurrent: boolean;
  comments: Comment[];
  onSeek: (seconds: number) => void;
}) {
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const floatingComments = useSettingsStore((s) => s.floatingComments);
  const playingCopy = usePlayingCopy(track.urn);
  const copy = isCurrent ? playingCopy : null;

  useEffect(() => {
    if (!isCurrent) {
      if (elapsedRef.current) elapsedRef.current.textContent = '0:00';
      return;
    }
    const paint = () => {
      if (elapsedRef.current)
        elapsedRef.current.textContent = durLong(Math.floor(getCurrentTime() * 1000));
    };
    paint();
    return subscribe(paint);
  }, [isCurrent]);

  const durationMs = track.full_duration ?? track.duration;

  return (
    <div className="relative">
      <div className="relative w-full">
        <LiveWaveform track={track} isCurrent={isCurrent} />
        <MomentMarks
          trackUrn={track.urn}
          durationMs={durationMs}
          isCurrent={isCurrent}
          onSeek={onSeek}
        />
        {floatingComments && (
          <WaveVoices
            comments={comments}
            durationMs={durationMs}
            isCurrent={isCurrent}
            onSeek={onSeek}
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-2.5 px-0.5 text-[11px] tabular-nums text-ink-40">
        <span ref={elapsedRef}>0:00</span>
        <span>{durLong((copy ?? track).duration)}</span>
      </div>
    </div>
  );
});
