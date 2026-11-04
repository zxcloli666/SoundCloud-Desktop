import { useTranslation } from 'react-i18next';
import { MonitorSmartphone } from '../../../../lib/chat/icons';
import type { Device, Millis } from '../../../../lib/chat/types';
import { RefreshCw } from '../../../../lib/icons';
import { notifyError } from '../../../../lib/notify';
import { useChatStore } from '../../../../stores/chat';
import { isWaiting, useChatDevicesStore } from '../../../../stores/chat/devices';
import { Card } from '../../../settings/primitives';
import { DecisionButton } from '../../devices/DecisionButton';
import { deviceErrorKey } from '../../devices/errors';
import {
  type DeviceActionKind,
  findCurrent,
  useDeviceAction,
  useDevices,
} from '../../devices/useDevices';
import { useNow } from '../../devices/useNow';
import { DeviceLimit } from './DeviceLimit';
import { DeviceRow } from './DeviceRow';
import { grownIn } from './hints';
import { YoungNote } from './YoungNote';

const DEFAULT_MAX = 10;
const SKELETON = ['a', 'b', 'c'];

function rank(device: Device, now: Millis): number {
  if (device.current) return 0;
  if (isWaiting(device, now)) return 1;
  return device.status === 'active' ? 2 : 3;
}

function ordered(devices: Device[], now: Millis): Device[] {
  return [...devices].sort((a, b) => rank(a, now) - rank(b, now) || b.lastSeenAt - a.lastSeenAt);
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-1">
      {SKELETON.map((key) => (
        <div key={key} className="flex items-center gap-3 px-2 py-2.5">
          <span className="h-11 w-11 rounded-full bg-ink/[0.05]" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3 w-28 rounded-full bg-ink/[0.06]" />
            <span className="h-2.5 w-44 rounded-full bg-ink/[0.04]" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function DevicesCard() {
  const { t } = useTranslation();
  const query = useDevices();
  const max = useChatStore((state) => state.config?.limits.devicesMax ?? DEFAULT_MAX);
  const dismissAlert = useChatDevicesStore((state) => state.dismissAlert);
  const now = useNow(60_000);
  const action = useDeviceAction(({ id }) => dismissAlert(id));

  const devices = query.data ? ordered(query.data, now) : [];
  const me = findCurrent(query.data);
  const active = devices.filter((device) => device.status === 'active').length;
  const olderThanMe = me
    ? devices.some((device) => device.status === 'active' && device.createdAt < me.createdAt)
    : false;
  const busyId = action.isPending ? action.variables?.id : null;

  const run = (device: Device, kind: DeviceActionKind) =>
    action.mutate(
      { kind, id: device.id },
      { onError: (error) => notifyError(t(deviceErrorKey(error))) },
    );

  return (
    <Card
      title={t('chat.devices.list.title')}
      icon={<MonitorSmartphone size={17} />}
      action={query.data ? <DeviceLimit used={active} max={max} /> : undefined}
    >
      {query.isError && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-ink-45">{t('chat.devices.list.loadFailed')}</p>
          <DecisionButton
            tone="plain"
            size="sm"
            icon={<RefreshCw size={12} />}
            onClick={() => void query.refetch()}
          >
            {t('chat.devices.list.retry')}
          </DecisionButton>
        </div>
      )}
      {query.isLoading && <Skeleton />}
      {query.data && (
        <>
          {me && olderThanMe && grownIn(me, now) > 0 && <YoungNote me={me} now={now} />}
          <div className="flex flex-col gap-0.5">
            {devices.map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                me={me}
                now={now}
                busy={busyId === device.id ? (action.variables?.kind ?? null) : null}
                locked={action.isPending}
                onRun={run}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
