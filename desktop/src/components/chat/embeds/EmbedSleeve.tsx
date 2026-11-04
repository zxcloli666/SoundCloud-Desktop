import { memo } from 'react';
import { ink } from '../../../lib/chat/tone';
import { art } from '../../../lib/formatters';
import { Music, Pause, Play } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import './vinyl.css';

interface EmbedSleeveProps {
  artworkUrl: string | null;
  size: number;
  current: boolean;
  playing: boolean;
  disc?: boolean;
  disabled?: boolean;
  label: string;
  onToggle?: () => void;
}

function Disc({ size, current, playing }: { size: number; current: boolean; playing: boolean }) {
  const perf = usePerfMode();
  return (
    <span
      aria-hidden
      className="absolute left-0 top-0"
      style={{
        width: size,
        height: size,
        transform: `translateX(${Math.round(size * (current ? 0.36 : 0.2))}px)`,
        transition: 'transform 700ms var(--ease-apple)',
      }}
    >
      <span
        className="chat-vinyl-disc block h-full w-full rounded-full"
        style={{
          border: '0.5px solid rgb(var(--ink) / 0.18)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.45), inset 0 0 0 3px rgba(0,0,0,0.35)',
          animation: playing && perf.idleAnim ? 'spin 3.6s linear infinite' : undefined,
        }}
      />
    </span>
  );
}

export const EmbedSleeve = memo(function EmbedSleeve({
  artworkUrl,
  size,
  current,
  playing,
  disc = false,
  disabled = false,
  label,
  onToggle,
}: EmbedSleeveProps) {
  const src = art(artworkUrl, 't200x200');
  const reach = disc ? Math.round(size * 0.36) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size + reach, height: size }}>
      {disc && <Disc size={size} current={current} playing={playing} />}
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled || !onToggle}
        onClick={onToggle}
        className="group/sleeve relative z-[1] block overflow-hidden rounded-[12px] cursor-pointer disabled:cursor-default"
        style={{
          width: size,
          height: size,
          boxShadow: '0 8px 20px rgba(0,0,0,0.4), inset 0 0 0 0.5px rgba(255,255,255,0.1)',
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-ink-30"
            style={{
              background: `linear-gradient(145deg, ${ink(8)}, ${ink(2)})`,
            }}
          >
            <Music size={Math.round(size * 0.34)} />
          </span>
        )}
        {!disabled && onToggle && (
          <span
            className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity duration-300 ${
              current
                ? 'opacity-100'
                : 'opacity-0 group-hover/sleeve:opacity-100 group-focus-visible/sleeve:opacity-100'
            }`}
          >
            {playing ? (
              <Pause size={Math.round(size * 0.3)} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={Math.round(size * 0.3)} fill="currentColor" strokeWidth={0} />
            )}
          </span>
        )}
      </button>
    </div>
  );
});
