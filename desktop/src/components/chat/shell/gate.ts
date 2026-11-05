import type { ChatPhase } from '../../../lib/chat/types';

export type Gate = 'keychain' | 'relogin' | 'revoked' | 'off' | 'loading' | 'open';

export function gateOf(enabled: boolean, phase: ChatPhase | null): Gate {
  if (phase === 'keychain_denied' || phase === 'keychain_unavailable') return 'keychain';
  if (phase === 'unbound' || phase === 'bound_other') return 'relogin';
  if (phase === 'revoked') return 'revoked';
  if (!enabled) return 'off';
  return phase === 'ready' ? 'open' : 'loading';
}
