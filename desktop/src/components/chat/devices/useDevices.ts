import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatBridge } from '../../../lib/chat/bridge';
import type { Device, DeviceId } from '../../../lib/chat/types';
import { selectChatEnabled, useChatStore } from '../../../stores/chat';

const DEVICES_KEY = ['chat', 'devices'] as const;

export type DeviceActionKind = 'confirm' | 'notMe' | 'remove';

export interface DeviceAction {
  kind: DeviceActionKind;
  id: DeviceId;
}

const RUN: Record<DeviceActionKind, (id: DeviceId) => Promise<void>> = {
  confirm: (id) => chatBridge.deviceConfirm(id),
  notMe: (id) => chatBridge.deviceNotMe(id),
  remove: (id) => chatBridge.deviceRemove(id),
};

export function useDevices(active = true) {
  const ready = useChatStore(
    (state) => selectChatEnabled(state) && state.status?.phase === 'ready',
  );
  return useQuery<Device[]>({
    queryKey: DEVICES_KEY,
    queryFn: () => chatBridge.devices(),
    staleTime: 30_000,
    enabled: ready && active,
  });
}

export function useDeviceAction(onDone?: (action: DeviceAction) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: DeviceAction) => RUN[kind](id),
    onSuccess: (_result, action) => {
      void queryClient.invalidateQueries({ queryKey: DEVICES_KEY });
      onDone?.(action);
    },
  });
}

export function findCurrent(devices: Device[] | undefined): Device | undefined {
  return devices?.find((device) => device.current);
}
