import { MonitorSmartphone } from '../../../lib/chat/icons';
import { Monitor, Smartphone } from '../../../lib/icons';

const DESKTOP = new Set(['macos', 'windows', 'linux']);
const MOBILE = new Set(['android', 'ios']);

export function platformIcon(platform: string) {
  if (DESKTOP.has(platform)) return Monitor;
  if (MOBILE.has(platform)) return Smartphone;
  return MonitorSmartphone;
}
