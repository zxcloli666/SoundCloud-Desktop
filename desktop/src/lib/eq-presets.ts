import { useSettingsStore } from '../stores/settings';
import { EQ_PRESETS } from './equalizer';

export function applyEqPreset(id: string) {
  const { eqCustomPresets, setEqGains, setEqPreamp, setEqPreset } = useSettingsStore.getState();
  const custom = eqCustomPresets.find((preset) => preset.id === id);
  const preset = EQ_PRESETS[id] ?? custom;
  if (!preset) return;
  setEqGains([...preset.gains]);
  setEqPreamp(custom?.preamp ?? null);
  setEqPreset(id);
}
