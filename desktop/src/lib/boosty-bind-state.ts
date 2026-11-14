import type { BoostyBinds, BoostyMethod, Renewal } from './pay-client';

export type BindState = 'none' | 'linked' | 'rebind';

export interface LinkedBindState {
  method: BoostyMethod;
  rebind: boolean;
}

export const BIND_METHODS: BoostyMethod[] = ['card', 'card_usd', 'sbp'];

export const BOOSTY_SOURCE = 'boosty_card';

export function bindState(binds: BoostyBinds | undefined, method: BoostyMethod): BindState {
  if (!binds?.binds[method]) return 'none';
  return binds.rebind?.[method] ? 'rebind' : 'linked';
}

export function linkedBinds(binds: BoostyBinds | undefined): LinkedBindState[] {
  return BIND_METHODS.flatMap((method) => {
    const state = bindState(binds, method);
    return state === 'none' ? [] : [{ method, rebind: state === 'rebind' }];
  });
}

function renewalMethods(renewal: Renewal, binds: BoostyBinds | undefined): BoostyMethod[] {
  if (renewal.method !== undefined) {
    return [renewal.method === 'sbp' || renewal.method === 'card_usd' ? renewal.method : 'card'];
  }
  if (renewal.currency === 'USD') return ['card_usd'];
  return (['card', 'sbp'] as const).filter((method) => binds?.binds[method]);
}

export function renewalRelink(
  renewal: Renewal,
  binds: BoostyBinds | undefined,
): BoostyMethod | null {
  if (renewal.source !== BOOSTY_SOURCE) return null;
  const methods = renewalMethods(renewal, binds);
  const waits = methods.length > 0 && methods.every((m) => bindState(binds, m) === 'rebind');
  return waits ? methods[0] : null;
}
