import type { DesktopOs } from '../platform';
import type { ChatPhase, KeyStorage, ResetPlan } from './types';

export type Gate = 'keychain' | 'relogin' | 'revoked' | 'off' | 'limit' | 'loading' | 'open';
export type KeychainReason = 'keychain_denied' | 'keychain_unavailable';

export function gateOf(enabled: boolean, phase: ChatPhase | null, limited = false): Gate {
  if (phase === 'keychain_denied' || phase === 'keychain_unavailable') return 'keychain';
  if (phase === 'unbound' || phase === 'bound_other') return 'relogin';
  if (phase === 'revoked') return 'revoked';
  if (!enabled) return 'off';
  if (phase === 'starting' && limited) return 'limit';
  return phase === 'ready' ? 'open' : 'loading';
}

export function chatNavShown(
  enabled: boolean,
  configKnown: boolean,
  phase: ChatPhase | null,
): boolean {
  if (enabled || configKnown) return enabled;
  const gate = gateOf(false, phase);
  return gate === 'keychain' || gate === 'relogin' || gate === 'revoked';
}

export function chatSettingsShown(enabled: boolean, phase: ChatPhase | null): boolean {
  return enabled || gateOf(enabled, phase) === 'keychain';
}

export function keychainText(reason: KeychainReason, storage: KeyStorage, os: DesktopOs): string {
  if (reason === 'keychain_denied') return `chat.relogin.keychain.${os}`;
  return `chat.relogin.keychain.unavailable.${storage === 'file' ? 'file' : os}`;
}

export function resetLinkText(storage: KeyStorage): string {
  return storage === 'file'
    ? 'chat.relogin.keychain.reset.openFile'
    : 'chat.relogin.keychain.reset.open';
}

export function resetWhereText(plan: ResetPlan, os: DesktopOs): string {
  if (plan === 'probe') return 'chat.relogin.keychain.reset.probe';
  if (plan === 'in_place') return `chat.relogin.keychain.reset.os.${os}`;
  return `chat.relogin.keychain.reset.file.${os}`;
}

export function keyStorageText(storage: KeyStorage, os: DesktopOs): string {
  return storage === 'file' ? 'chat.settings.keys.file' : `chat.settings.keys.os.${os}`;
}
