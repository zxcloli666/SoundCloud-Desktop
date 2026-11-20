import React, { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { getPlaybackClock } from '../../lib/audio';
import { FADE_MS } from '../../lib/video-drive';
import { clockTime, type PlaybackClock } from '../../lib/video-sync';
import { type Track, usePlayerStore } from '../../stores/player';
import {
  onPlayerSeek,
  usePrefetchUpcoming,
  useTrackVideos,
  VideoLayer,
} from '../music/lyrics/TrackVideo';
import { useVideoAllowed } from '../music/lyrics/useTrackVideo';

const SETTLE = 'cubic-bezier(0.4, 0, 0.2, 1)';

export const RoomVideo = React.memo(function RoomVideo({ on }: { on: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const seen = useSeen(boxRef);
  const current = usePlayerStore((s) => s.currentTrack);
  const track = useLinger(on ? current : null);
  return (
    <div
      ref={boxRef}
      data-ui="track-cover-video"
      data-leaving={on ? undefined : ''}
      className="pointer-events-none absolute inset-0 group-hover:scale-[1.06]"
      style={{
        opacity: on ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease-out, transform 1000ms ${SETTLE}`,
      }}
    >
      {seen && track && <RoomLayer track={track} live={on} />}
    </div>
  );
});

function RoomLayer({ track, live }: { track: Track; live: boolean }) {
  const allowed = useVideoAllowed();
  const videos = useTrackVideos(track, allowed);
  const clock = useRoomClock(live);
  usePrefetchUpcoming(allowed && live);
  return (
    <VideoLayer host="room" urn={track.urn} videos={videos} clock={clock} onSeek={onPlayerSeek} />
  );
}

function useSeen(ref: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const observer = new IntersectionObserver(([entry]) => setSeen(entry.isIntersecting));
    observer.observe(box);
    return () => observer.disconnect();
  }, [ref]);
  return seen;
}

function useLinger(track: Track | null): Track | null {
  const [kept, setKept] = useState(track);
  useEffect(() => {
    if (track) {
      setKept(track);
      return;
    }
    const timer = window.setTimeout(() => setKept(null), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [track]);
  return track ?? kept;
}

function useRoomClock(live: boolean): () => PlaybackClock {
  const last = useRef(getPlaybackClock());
  const frozen = useRef<PlaybackClock | null>(null);
  return useCallback(() => {
    if (live) {
      frozen.current = null;
      last.current = getPlaybackClock();
      return last.current;
    }
    const now = performance.now();
    frozen.current ??= {
      ...last.current,
      pos: clockTime(last.current, now),
      at: now,
      playing: false,
    };
    return frozen.current;
  }, [live]);
}
