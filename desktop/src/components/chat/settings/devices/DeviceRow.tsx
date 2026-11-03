import { useTranslation } from 'react-i18next';
import type { Device, Millis } from '../../../../lib/chat/types';
import { isWaiting } from '../../../../stores/chat/devices';
import { DeviceFacts } from '../../devices/DeviceFacts';
import { DeviceGlyph } from '../../devices/DeviceGlyph';
import { exactText, seenText } from '../../devices/time';
import type { DeviceActionKind } from '../../devices/useDevices';
import { RowActions } from './RowActions';

interface DeviceRowProps {
  device: Device;
  me: Device | undefined;
  now: Millis;
  busy: DeviceActionKind | null;
  locked: boolean;
  onRun: (device: Device, kind: DeviceActionKind) => void;
}

function Tag({ tone, children }: { tone: 'accent' | 'rose' | 'wait'; children: string }) {
  const look = {
    accent: 'bg-[var(--color-accent-glow)] text-[var(--color-accent)]',
    rose: 'bg-rose-500/12 text-rose-300/90',
    wait: 'bg-ink/[0.06] text-ink-55',
  }[tone];
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${look}`}
    >
      {children}
    </span>
  );
}

export function DeviceRow({ device, me, now, busy, locked, onRun }: DeviceRowProps) {
  const { t, i18n } = useTranslation();
  const revoked = device.status === 'revoked';
  const waiting = isWaiting(device, now);
  const seen = device.current
    ? t('chat.devices.seen.now')
    : seenText(t, i18n.language, device.lastSeenAt, now);

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-2 py-2.5 transition-colors hover:bg-ink/[0.025] ${revoked ? 'opacity-45' : ''}`}
    >
      <DeviceGlyph
        device={device}
        now={now}
        size={44}
        title={t('chat.devices.list.added', { at: exactText(i18n.language, device.createdAt) })}
      />
      <div className="min-w-[180px] flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            title={device.name}
            className="min-w-0 truncate text-[13.5px] font-semibold text-ink-85"
          >
            {device.name}
          </span>
          {device.current && <Tag tone="accent">{t('chat.devices.list.current')}</Tag>}
          {waiting && !device.current && <Tag tone="wait">{t('chat.devices.list.waiting')}</Tag>}
          {revoked && <Tag tone="rose">{t('chat.devices.list.revoked')}</Tag>}
        </div>
        <div className="mt-1">
          <DeviceFacts device={device} time={seen} />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <RowActions
          device={device}
          me={me}
          now={now}
          busy={busy}
          locked={locked}
          onRun={(kind) => onRun(device, kind)}
        />
      </div>
    </div>
  );
}
