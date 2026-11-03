import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { surface } from '../../../lib/chat/tone';
import type { Device, Millis } from '../../../lib/chat/types';
import { useChatStore } from '../../../stores/chat';
import { AGE_RULE_MS } from '../../../stores/chat/devices';
import { HistoryRing } from './HistoryRing';
import { platformIcon } from './platform';
import { exactText, spanShort, spanText } from './time';
import { findCurrent, useDevices } from './useDevices';
import { useNow } from './useNow';

const CONFIRMERS_SHOWN = 3;

function canConfirm(device: Device, me: Device, now: Millis): boolean {
  return (
    !device.current &&
    device.status === 'active' &&
    device.createdAt < me.createdAt &&
    now - device.createdAt >= AGE_RULE_MS
  );
}

function Confirmers({ devices }: { devices: Device[] }) {
  return (
    <span className="flex -space-x-1.5">
      {devices.slice(0, CONFIRMERS_SHOWN).map((device) => {
        const Icon = platformIcon(device.platform);
        return (
          <span
            key={device.id}
            title={device.name}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-ink/10 text-ink-70"
            style={{ background: surface(11) }}
          >
            <Icon size={12} strokeWidth={1.8} />
          </span>
        );
      })}
    </span>
  );
}

function LockedBanner({ unlocksAt }: { unlocksAt: Millis }) {
  const { t, i18n } = useTranslation();
  const now = useNow(60_000);
  const devices = useDevices().data;
  const me = findCurrent(devices);
  const confirmers = me ? (devices ?? []).filter((device) => canConfirm(device, me, now)) : [];
  const left = Math.max(0, unlocksAt - now);
  const alone = devices !== undefined && confirmers.length === 0;
  if (left === 0) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-2xl border border-ink/[0.07] bg-ink/[0.035] px-3.5 py-3"
    >
      <HistoryRing
        size={42}
        stroke={2.5}
        tone="wait"
        progress={1 - left / AGE_RULE_MS}
        title={exactText(i18n.language, unlocksAt)}
      >
        <span className="text-[10.5px] font-semibold tabular-nums text-ink-75">
          {spanShort(t, left)}
        </span>
      </HistoryRing>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] leading-snug text-ink-75">
          {alone
            ? t('chat.devices.banner.alone', { span: spanText(t, left) })
            : t('chat.devices.banner.title')}
        </p>
        {!alone && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-40">
            {confirmers.length > 0 && <Confirmers devices={confirmers} />}
            <span>{t('chat.devices.banner.orIn', { span: spanText(t, left) })}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const HistoryLockedBanner = memo(function HistoryLockedBanner() {
  const locked = useChatStore((state) => state.status?.history.locked === true);
  const unlocksAt = useChatStore((state) => state.status?.history.unlocksAt ?? null);
  if (!locked || unlocksAt === null) return null;
  return <LockedBanner unlocksAt={unlocksAt} />;
});
