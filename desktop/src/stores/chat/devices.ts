import { create } from 'zustand';
import type { Device, DeviceId, Millis } from '../../lib/chat/types';

export const AGE_RULE_MS = 72 * 3_600_000;
const REMIND_EVERY_MS = 24 * 3_600_000;

export function isWaiting(device: Device, now: Millis): boolean {
  return (
    device.status === 'active' && !device.historyUnlocked && now < device.createdAt + AGE_RULE_MS
  );
}

function nextReminder(device: Device, now: Millis): Millis | null {
  const days = Math.floor((now - device.createdAt) / REMIND_EVERY_MS) + 1;
  const at = device.createdAt + days * REMIND_EVERY_MS;
  return at < device.createdAt + AGE_RULE_MS ? at : null;
}

export interface SnoozedAlert {
  device: Device;
  wakeAt: Millis;
}

export interface ChatDevicesState {
  alerts: Device[];
  snoozed: SnoozedAlert[];
  pushAlert: (device: Device) => void;
  dismissAlert: (deviceId: DeviceId) => void;
  snoozeAlert: (deviceId: DeviceId, now: Millis) => void;
  wakeSnoozed: (now: Millis) => void;
  syncAlerts: (devices: Device[], now: Millis) => void;
}

export const useChatDevicesStore = create<ChatDevicesState>()((set) => ({
  alerts: [],
  snoozed: [],
  pushAlert: (device) =>
    set((state) => ({
      alerts: [...state.alerts.filter((alert) => alert.id !== device.id), device],
      snoozed: state.snoozed.filter((entry) => entry.device.id !== device.id),
    })),
  dismissAlert: (deviceId) =>
    set((state) => ({
      alerts: state.alerts.filter((alert) => alert.id !== deviceId),
      snoozed: state.snoozed.filter((entry) => entry.device.id !== deviceId),
    })),
  snoozeAlert: (deviceId, now) =>
    set((state) => {
      const device = state.alerts.find((alert) => alert.id === deviceId);
      const wakeAt = device ? nextReminder(device, now) : null;
      const snoozed = state.snoozed.filter((entry) => entry.device.id !== deviceId);
      return {
        alerts: state.alerts.filter((alert) => alert.id !== deviceId),
        snoozed: device && wakeAt !== null ? [...snoozed, { device, wakeAt }] : snoozed,
      };
    }),
  wakeSnoozed: (now) =>
    set((state) => {
      if (!state.snoozed.some((entry) => entry.wakeAt <= now)) return state;
      const woken = state.snoozed
        .filter((entry) => entry.wakeAt <= now && isWaiting(entry.device, now))
        .map((entry) => entry.device)
        .filter((device) => !state.alerts.some((alert) => alert.id === device.id));
      return {
        alerts: [...state.alerts, ...woken],
        snoozed: state.snoozed.filter((entry) => entry.wakeAt > now),
      };
    }),
  syncAlerts: (devices, now) =>
    set((state) => {
      const fresh = new Map(devices.map((device) => [device.id, device]));
      const latest = (device: Device) => fresh.get(device.id) ?? device;
      return {
        alerts: state.alerts.map(latest).filter((device) => isWaiting(device, now)),
        snoozed: state.snoozed
          .map((entry) => ({ ...entry, device: latest(entry.device) }))
          .filter((entry) => isWaiting(entry.device, now)),
      };
    }),
}));
