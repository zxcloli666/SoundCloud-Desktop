import type { ChatPhase } from '../../lib/chat/types';

export type AccountChange = 'none' | 'arrived' | 'switched';

const LOCAL_PHASES: ReadonlySet<ChatPhase> = new Set(['starting', 'ready', 'off']);

export function accountChange(
  before: { userId: string | null } | null,
  after: { userId: string | null },
): AccountChange {
  if (before === null || before.userId === after.userId) return 'none';
  return before.userId === null ? 'arrived' : 'switched';
}

export function holdsLocalStore(phase: ChatPhase | null): boolean {
  return phase !== null && LOCAL_PHASES.has(phase);
}

export function uploadActionsRun(phase: ChatPhase | null, local: boolean): boolean {
  return local && holdsLocalStore(phase);
}
