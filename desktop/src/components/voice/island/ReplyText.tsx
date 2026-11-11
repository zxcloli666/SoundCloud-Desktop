import { memo, useLayoutEffect, useRef, useState } from 'react';
import { useChatLive } from '../../../lib/voice/chat/live';
import { Dots } from './parts';

const FADE = 'linear-gradient(to bottom, transparent, #000 1.6em)';

export const ReplyText = memo(function ReplyText({ live }: { live: boolean }) {
  const parts = useChatLive((s) => s.parts);
  const box = useRef<HTMLSpanElement>(null);
  const [above, setAbove] = useState(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (live && parts.length > 0) el.scrollTop = el.scrollHeight;
    setAbove(el.scrollTop > 1);
  }, [parts, live]);

  if (parts.length === 0) {
    return live ? (
      <span className="mt-1 flex h-[18px] items-center text-accent">
        <Dots />
      </span>
    ) : null;
  }
  return (
    <span
      ref={box}
      data-ui="voice-reply"
      onScroll={(e) => setAbove(e.currentTarget.scrollTop > 1)}
      className="scrollbar-hide mt-0.5 block max-h-[8.4em] overflow-y-auto whitespace-pre-wrap break-words text-[13px] font-medium leading-[1.4] text-ink-90"
      style={{
        isolation: 'isolate',
        maskImage: above ? FADE : undefined,
        WebkitMaskImage: above ? FADE : undefined,
      }}
    >
      {live
        ? parts.map((part, i) => (
            <span
              key={i}
              className="motion-reduce:animate-none"
              style={{ animation: 'vx-ink 420ms ease-out both' }}
            >
              {part}
            </span>
          ))
        : parts.join('')}
    </span>
  );
});
