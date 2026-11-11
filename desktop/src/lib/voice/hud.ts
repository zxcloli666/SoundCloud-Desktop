import type { HudView } from './runtime';

export interface DismissPort {
  declineLink(id: string): void;
  stopChat(id: string): void;
  cancelEngine(): void;
  hide(): void;
}

const CANCELS_ENGINE = new Set<HudView['kind']>([
  'asking',
  'listening',
  'thinking',
  'speaking',
  'chat',
]);

export function dismiss(hud: HudView, port: DismissPort) {
  if (hud.kind === 'link_confirm') return port.declineLink(hud.id);
  if (hud.kind === 'chat') port.stopChat(hud.id);
  if (CANCELS_ENGINE.has(hud.kind)) port.cancelEngine();
  port.hide();
}
