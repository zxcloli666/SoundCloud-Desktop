import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { Device } from '../../../lib/chat/types';
import { useChatDevicesStore } from '../../../stores/chat/devices';
import { Modal } from '../../ui/Modal';
import { DeviceAlertModal } from './DeviceAlertModal';
import { useDevices } from './useDevices';
import { useNow } from './useNow';

function useFreshAlerts(active: boolean) {
  const devices = useDevices(active);
  const syncAlerts = useChatDevicesStore((state) => state.syncAlerts);
  useEffect(() => {
    if (active && devices.data) syncAlerts(devices.data, Date.now());
  }, [active, devices.data, syncAlerts]);
}

function useReminders() {
  const sleeping = useChatDevicesStore((state) => state.snoozed.length > 0);
  const wakeSnoozed = useChatDevicesStore((state) => state.wakeSnoozed);
  const now = useNow(60_000, sleeping);
  useEffect(() => {
    if (sleeping) wakeSnoozed(now);
  }, [sleeping, now, wakeSnoozed]);
}

export const DeviceAlertHost = memo(function DeviceAlertHost() {
  const head = useChatDevicesStore((state) => state.alerts[0] ?? null);
  const queued = useChatDevicesStore((state) => state.alerts.length);
  const dismissAlert = useChatDevicesStore((state) => state.dismissAlert);
  const snoozeAlert = useChatDevicesStore((state) => state.snoozeAlert);
  const [held, setHeld] = useState<Device | null>(null);
  const last = useRef<Device | null>(null);

  useFreshAlerts(queued > 0 && held === null);
  useReminders();

  const device = held ?? head;
  if (device) last.current = device;
  const shown = device ?? last.current;
  const shownId = device?.id ?? null;

  const finish = useCallback(() => {
    setHeld(null);
    if (shownId) dismissAlert(shownId);
  }, [shownId, dismissAlert]);

  const later = useCallback(() => {
    if (held) finish();
    else if (shownId) snoozeAlert(shownId, Date.now());
  }, [held, shownId, finish, snoozeAlert]);

  if (!shown) return null;

  return (
    <Modal
      open={device !== null}
      onOpenChange={(open) => {
        if (!open) later();
      }}
    >
      <DeviceAlertModal
        key={shown.id}
        device={shown}
        open={device !== null}
        queued={Math.max(queued, 1)}
        onHold={setHeld}
        onClose={finish}
      />
    </Modal>
  );
});
