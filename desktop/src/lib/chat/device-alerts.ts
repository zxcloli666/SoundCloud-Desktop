import type { Device, DeviceId, Millis } from './types';

export const AGE_RULE_MS = 72 * 3_600_000;
const REMIND_EVERY_MS = 24 * 3_600_000;

export interface SnoozedAlert {
  device: Device;
  wakeAt: Millis;
}

export interface DeviceAlerts {
  alerts: Device[];
  snoozed: SnoozedAlert[];
  quiet: Record<DeviceId, Millis>;
}

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

function without(state: DeviceAlerts, id: DeviceId): DeviceAlerts {
  return {
    ...state,
    alerts: state.alerts.filter((alert) => alert.id !== id),
    snoozed: state.snoozed.filter((entry) => entry.device.id !== id),
  };
}

export function pushed(state: DeviceAlerts, device: Device, now: Millis): DeviceAlerts {
  const rest = without(state, device.id);
  const wakeAt = state.quiet[device.id] ?? 0;
  if (wakeAt <= now) return { ...rest, alerts: [...rest.alerts, device] };
  if (wakeAt >= device.createdAt + AGE_RULE_MS) return rest;
  return { ...rest, snoozed: [...rest.snoozed, { device, wakeAt }] };
}

export function dismissed(state: DeviceAlerts, id: DeviceId): DeviceAlerts {
  const device =
    state.alerts.find((alert) => alert.id === id) ??
    state.snoozed.find((entry) => entry.device.id === id)?.device;
  const rest = without(state, id);
  if (!device) return rest;
  return { ...rest, quiet: { ...rest.quiet, [id]: device.createdAt + AGE_RULE_MS } };
}

export function snoozed(state: DeviceAlerts, id: DeviceId, now: Millis): DeviceAlerts {
  const device = state.alerts.find((alert) => alert.id === id);
  const wakeAt = device ? nextReminder(device, now) : null;
  if (!device || wakeAt === null) return dismissed(state, id);
  const rest = without(state, id);
  return {
    ...rest,
    snoozed: [...rest.snoozed, { device, wakeAt }],
    quiet: { ...rest.quiet, [id]: wakeAt },
  };
}

export function woken(state: DeviceAlerts, now: Millis): DeviceAlerts {
  if (!state.snoozed.some((entry) => entry.wakeAt <= now)) return state;
  const due = state.snoozed
    .filter((entry) => entry.wakeAt <= now && isWaiting(entry.device, now))
    .map((entry) => entry.device)
    .filter((device) => !state.alerts.some((alert) => alert.id === device.id));
  return {
    ...state,
    alerts: [...state.alerts, ...due],
    snoozed: state.snoozed.filter((entry) => entry.wakeAt > now),
  };
}

export function synced(state: DeviceAlerts, devices: Device[], now: Millis): DeviceAlerts {
  const fresh = new Map(devices.map((device) => [device.id, device]));
  const latest = (device: Device) => fresh.get(device.id) ?? device;
  return {
    ...state,
    alerts: state.alerts.map(latest).filter((device) => isWaiting(device, now)),
    snoozed: state.snoozed
      .map((entry) => ({ ...entry, device: latest(entry.device) }))
      .filter((entry) => isWaiting(entry.device, now)),
  };
}

export function restored(
  state: DeviceAlerts,
  quiet: Record<DeviceId, Millis>,
  now: Millis,
): DeviceAlerts {
  const pending = Object.entries(quiet).filter(([, until]) => until > now);
  const start = { ...state, alerts: [], quiet: { ...Object.fromEntries(pending), ...state.quiet } };
  return state.alerts.reduce((next, device) => pushed(next, device, now), start as DeviceAlerts);
}
