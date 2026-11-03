import { type CSSProperties, memo, useId, useRef } from 'react';
import { usePerfMode } from '../../lib/perf';
import { SPEECH } from '../../lib/voice/levels';
import { MARKS } from './avatars';
import { LolyaMark } from './avatars/LolyaMark';
import { useLevelDrive } from './useLevelDrive';
import type { VoiceInfo } from './voices';

const LEVEL_EASE = 'transform 90ms linear, opacity 90ms linear';

export const VoiceAvatar = memo(function VoiceAvatar({
  voice,
  size,
  speaking = false,
}: {
  voice: VoiceInfo;
  size: number;
  speaking?: boolean;
}) {
  const perf = usePerfMode();
  const uid = `vx${useId().replace(/[^\w-]/g, '')}`;
  const pulse = useRef<HTMLSpanElement>(null);
  useLevelDrive(pulse, SPEECH, speaking);
  const Mark = MARKS[voice.id] ?? LolyaMark;
  const body: CSSProperties = {
    transform: speaking ? 'scale(calc(1 + var(--lvl, 0) * 0.08))' : undefined,
    transition: speaking ? LEVEL_EASE : undefined,
    boxShadow: perf.glow
      ? `0 ${size * 0.12}px ${size * 0.4}px -${size * 0.16}px ${voice.glow}`
      : undefined,
  };

  return (
    <span
      data-ui="voice-avatar"
      data-scheme="dark"
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      <span ref={pulse} className="absolute inset-0">
        {speaking && (
          <>
            {[0, 1].map((i) => (
              <span
                key={i}
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{
                  border: `1.5px solid ${voice.glow}`,
                  animation: `vx-ripple 1.8s var(--ease-apple) ${i * 0.9}s infinite`,
                }}
              />
            ))}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                border: `2px solid ${voice.glow}`,
                opacity: 'calc(0.25 + var(--lvl, 0) * 0.75)',
                transform: 'scale(calc(1.06 + var(--lvl, 0) * 0.24))',
                transition: LEVEL_EASE,
              }}
            />
          </>
        )}
        <span className="relative block size-full overflow-hidden rounded-full" style={body}>
          {voice.image ? (
            <img src={voice.image} alt="" draggable={false} className="size-full object-cover" />
          ) : (
            <Mark uid={uid} idle={perf.idleAnim} />
          )}
        </span>
      </span>
    </span>
  );
});
