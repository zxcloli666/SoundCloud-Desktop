import type { HudView } from './runtime';
import type { VoiceErrorCode } from './types';

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

export function afterError(hud: HudView, code: VoiceErrorCode): HudView {
  if (hud.kind === 'chat' && code === 'tts_failed') return { ...hud, voiceLost: true };
  return { kind: 'error', code };
}
