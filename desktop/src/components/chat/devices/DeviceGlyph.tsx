import { memo } from 'react';
import type { Device, Millis } from '../../../lib/chat/types';
import { AGE_RULE_MS, isWaiting } from '../../../stores/chat/devices';
import { HistoryRing, type RingTone } from './HistoryRing';
import { platformIcon } from './platform';

interface DeviceGlyphProps {
  device: Device;
  now: Millis;
  size: number;
  stroke?: number;
  outcome?: Exclude<RingTone, 'wait'> | null;
  title?: string;
}

function tileClass(device: Device, outcome: DeviceGlyphProps['outcome']): string {
  if (outcome === 'closed' || device.status === 'revoked') return 'bg-rose-500/10 text-rose-300/80';
  if (outcome === 'open') return 'bg-emerald-500/12 text-emerald-300';
  if (device.current) return 'bg-[var(--color-accent-glow)] text-[var(--color-accent)]';
  return 'bg-ink/[0.06] text-ink-65';
}

export const DeviceGlyph = memo(function DeviceGlyph({
  device,
  now,
  size,
  stroke = 2,
  outcome = null,
  title,
}: DeviceGlyphProps) {
  const Icon = platformIcon(device.platform);
  const waiting = isWaiting(device, now);
  const tone: RingTone | null = outcome ?? (waiting ? 'wait' : null);
  const tile = Math.round(size - stroke * 2 - Math.max(4, size * 0.08) * 2);
  const tileNode = (
    <span
      className={`flex items-center justify-center rounded-full transition-colors duration-500 ${tileClass(device, outcome)}`}
      style={{ width: tile, height: tile }}
    >
      <Icon size={Math.round(tile * 0.52)} strokeWidth={1.7} />
    </span>
  );

  if (!tone) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
        title={title}
      >
        {tileNode}
      </span>
    );
  }

  return (
    <HistoryRing
      size={size}
      stroke={stroke}
      tone={tone}
      progress={(now - device.createdAt) / AGE_RULE_MS}
      title={title}
    >
      {tileNode}
    </HistoryRing>
  );
});
