import { invoke } from '@tauri-apps/api/core';

let holders = 0;

export function createSpectrumClaim() {
  let held = false;
  return (want: boolean) => {
    if (want === held) return;
    held = want;
    holders += want ? 1 : -1;
    void invoke('audio_set_fft_enabled', { enabled: holders > 0 }).catch(() => {});
  };
}
