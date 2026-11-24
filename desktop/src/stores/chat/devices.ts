import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  type DeviceAlerts,
  dismissed,
  pushed,
  restored,
  snoozed,
  synced,
  woken,
} from '../../lib/chat/device-alerts';
import type { Device, DeviceId, Millis } from '../../lib/chat/types';
import { tauriStorage } from '../../lib/tauri-storage';

export interface ChatDevicesState extends DeviceAlerts {
  pushAlert: (device: Device, now: Millis) => void;
  dismissAlert: (deviceId: DeviceId) => void;
  snoozeAlert: (deviceId: DeviceId, now: Millis) => void;
  wakeSnoozed: (now: Millis) => void;
  syncAlerts: (devices: Device[], now: Millis) => void;
}

export const useChatDevicesStore = create<ChatDevicesState>()(
  persist(
    (set) => ({
      alerts: [],
      snoozed: [],
      quiet: {},
      pushAlert: (device, now) => set((state) => pushed(state, device, now)),
      dismissAlert: (deviceId) => set((state) => dismissed(state, deviceId)),
      snoozeAlert: (deviceId, now) => set((state) => snoozed(state, deviceId, now)),
      wakeSnoozed: (now) => set((state) => woken(state, now)),
      syncAlerts: (devices, now) => set((state) => synced(state, devices, now)),
    }),
    {
      name: 'sc-chat-devices',
      version: 1,
      storage: createJSONStorage(() => tauriStorage),
      partialize: ({ quiet }) => ({ quiet }),
      merge: (saved, current) => ({
        ...current,
        ...restored(current, (saved as Partial<DeviceAlerts> | undefined)?.quiet ?? {}, Date.now()),
      }),
    },
  ),
);
