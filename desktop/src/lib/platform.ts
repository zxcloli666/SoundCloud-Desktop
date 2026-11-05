export function isMac(): boolean {
  return !!(navigator.platform?.startsWith('Mac') || navigator.userAgent.includes('Mac'));
}

export function isLinux(): boolean {
  return !!(navigator.platform?.startsWith('Linux') || navigator.userAgent.includes('Linux'));
}

export function isWindows(): boolean {
  return !!(navigator.platform?.startsWith('Win') || navigator.userAgent.includes('Windows'));
}

export type DesktopOs = 'mac' | 'linux' | 'windows';

export function desktopOs(): DesktopOs {
  if (isMac()) return 'mac';
  if (isLinux()) return 'linux';
  return 'windows';
}
