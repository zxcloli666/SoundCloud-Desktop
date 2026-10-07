import { create } from 'zustand';
import { useSettingsStore } from '../../stores/settings';
import { trackedInvoke as invoke } from '../diagnostics';
import { GLOBAL_HOTKEY_ACTIONS, type GlobalHotkeyAction, withDefaults } from './actions';

export type HotkeyStatus = 'active' | 'taken' | 'invalid';
export type HotkeyBackend = 'native' | 'wayland';

interface HotkeyOutcome {
  action: GlobalHotkeyAction;
  status: HotkeyStatus;
}

interface HotkeyRuntimeState {
  backend: HotkeyBackend;
  statuses: Partial<Record<GlobalHotkeyAction, HotkeyStatus>>;
}

export const useHotkeyRuntime = create<HotkeyRuntimeState>(() => ({
  backend: 'native',
  statuses: {},
}));

let suspended = false;
let pending: Promise<void> = Promise.resolve();

export function hotkeysSuspended() {
  return suspended;
}

function desiredBindings() {
  const { globalHotkeysEnabled, globalHotkeys } = useSettingsStore.getState();
  if (!globalHotkeysEnabled || suspended) return [];
  const map = withDefaults(globalHotkeys);
  return GLOBAL_HOTKEY_ACTIONS.filter((action) => map[action]).map((action) => ({
    action,
    accelerator: map[action],
  }));
}

export function syncGlobalHotkeys() {
  pending = pending.then(async () => {
    try {
      const outcomes = await invoke<HotkeyOutcome[]>('hotkeys_apply', {
        bindings: desiredBindings(),
      });
      if (suspended) return;
      const statuses: HotkeyRuntimeState['statuses'] = {};
      for (const outcome of outcomes) statuses[outcome.action] = outcome.status;
      useHotkeyRuntime.setState({ statuses });
    } catch (error) {
      console.error('[Hotkeys] apply failed', error);
    }
  });
  return pending;
}

export function suspendGlobalHotkeys(value: boolean) {
  if (suspended === value) return;
  suspended = value;
  void syncGlobalHotkeys();
}

export function loadHotkeyBackend() {
  invoke<HotkeyBackend>('hotkeys_backend')
    .then((backend) => useHotkeyRuntime.setState({ backend }))
    .catch(() => {});
}
