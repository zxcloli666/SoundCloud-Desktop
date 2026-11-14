import type { BoostyBinds, BoostyMethod } from './pay-client';

export type BindState = 'none' | 'linked' | 'rebind';

export interface LinkedBindState {
  method: BoostyMethod;
  rebind: boolean;
}

export const BIND_METHODS: BoostyMethod[] = ['card', 'card_usd', 'sbp'];

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
