import { memo } from 'react';
import { usePerfMode } from '../../lib/perf';
import { Bot } from './icons';
import type { VoiceInfo } from './voices';

export const VoiceAvatar = memo(function VoiceAvatar({
  voice,
  name,
  size,
  speaking = false,
}: {
  voice: VoiceInfo;
  name: string;
  size: number;
  speaking?: boolean;
}) {
  const perf = usePerfMode();
  const [from, to] = voice.colors;
  return (
    <span
      data-ui="voice-avatar"
      data-scheme="dark"
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size }}
    >
      {speaking &&
        [0, 1].map((i) => (
          <span
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-full motion-reduce:hidden"
            style={{
              border: `1.5px solid ${from}`,
              animation: `vx-ripple 1.6s var(--ease-apple) ${i * 0.8}s infinite`,
            }}
          />
        ))}
      <span
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full text-ink"
        style={{
          background: `radial-gradient(110% 110% at 28% 18%, ${from} 0%, ${to} 72%, color-mix(in srgb, ${to} 60%, #000) 100%)`,
          boxShadow: perf.glow
            ? `0 ${size * 0.12}px ${size * 0.4}px -${size * 0.14}px ${to}, inset 0 1px 0 rgba(255,255,255,0.4)`
            : 'inset 0 1px 0 rgba(255,255,255,0.4)',
        }}
      >
        <span
          aria-hidden
          className="absolute rounded-full"
          style={{
            inset: '6% 36% 60% 12%',
            background: 'radial-gradient(closest-side, #fff, transparent)',
            opacity: 0.45,
          }}
        />
        {voice.robot ? (
          <Bot size={Math.round(size * 0.46)} strokeWidth={1.9} className="relative" />
        ) : (
          <span
            className="relative font-black leading-none"
            style={{ fontFamily: 'var(--font-display)', fontSize: Math.round(size * 0.42) }}
          >
            {name.slice(0, 1)}
          </span>
        )}
      </span>
    </span>
  );
});
