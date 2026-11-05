import { useTranslation } from 'react-i18next';
import type { Device, Millis } from '../../../../lib/chat/types';
import { CircleCheck, Power, ShieldAlert, Trash2 } from '../../../../lib/icons';
import { isWaiting } from '../../../../stores/chat/devices';
import { DecisionButton } from '../../devices/DecisionButton';
import type { DeviceActionKind } from '../../devices/useDevices';
import { ArmedButton } from './ArmedButton';
import { confirmHint, removeHint } from './hints';

interface RowActionsProps {
  device: Device;
  me: Device | undefined;
  now: Millis;
  busy: DeviceActionKind | null;
  locked: boolean;
  onRun: (kind: DeviceActionKind) => void;
}

export function RowActions({ device, me, now, busy, locked, onRun }: RowActionsProps) {
  const { t } = useTranslation();
  if (device.status === 'revoked') return null;

  if (device.current) {
    return (
      <ArmedButton
        icon={<Power size={13} />}
        label={t('chat.devices.list.logout')}
        armedLabel={t('chat.devices.list.logoutSure')}
        busy={busy === 'remove'}
        disabled={locked}
        onConfirm={() => onRun('remove')}
      />
    );
  }

  const remove = (
    <ArmedButton
      icon={<Trash2 size={13} />}
      label={t('chat.devices.list.remove')}
      armedLabel={t('chat.devices.list.removeSure')}
      busy={busy === 'remove'}
      disabled={locked || !device.actions.remove}
      title={device.actions.remove ? undefined : removeHint(t, me, now)}
      onConfirm={() => onRun('remove')}
    />
  );

  if (!isWaiting(device, now)) return remove;

  return (
    <>
      <DecisionButton
        tone="yes"
        size="sm"
        icon={<CircleCheck size={13} />}
        busy={busy === 'confirm'}
        disabled={locked || !device.actions.confirm}
        title={device.actions.confirm ? undefined : confirmHint(t, device, me, now)}
        onClick={() => onRun('confirm')}
      >
        {t('chat.devices.alert.confirm')}
      </DecisionButton>
      {device.actions.notMe ? (
        <DecisionButton
          tone="no"
          size="sm"
          icon={<ShieldAlert size={13} />}
          busy={busy === 'notMe'}
          disabled={locked}
          onClick={() => onRun('notMe')}
        >
          {t('chat.devices.alert.notMe')}
        </DecisionButton>
      ) : (
        remove
      )}
    </>
  );
}
