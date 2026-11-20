import { openUrl } from '@tauri-apps/plugin-opener';
import { isMac, isWindows } from '../platform';

export function micPrivacyUrl(): string | null {
  if (isMac()) return 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone';
  if (isWindows()) return 'ms-settings:privacy-microphone';
  return null;
}

export function openMicPrivacy(): boolean {
  const url = micPrivacyUrl();
  if (!url) return false;
  void openUrl(url).catch(() => {});
  return true;
}
