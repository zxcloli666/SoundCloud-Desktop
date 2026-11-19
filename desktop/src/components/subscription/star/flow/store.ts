import { createContext, useContext } from 'react';
import { createStore, type StoreApi, useStore } from 'zustand';
import type { BindFlow, MethodId, Order, TierId } from '../../../../lib/pay-client';
import type { StarIntent } from '../../../../lib/star-offer';
import type { TrialBlock } from '../../../../lib/star-trial';
import type { Recipient, Step } from '../meta';

export type RefBonus = { code: string; days: number } | null;

export interface BindOnly {
  method: MethodId;
  flow: BindFlow;
  trial: boolean;
}

export interface Purchase {
  planId: string;
  method: MethodId;
  recurring: boolean;
  own: boolean;
  offerId: string | null;
}

export interface FlowState {
  step: Step;
  tier: TierId;
  recipient: Recipient;
  planId: string | null;
  methodId: MethodId | null;
  renewPref: boolean | null;
  refBonus: RefBonus;
  offerId: string | null;
  checkout: Order | null;
  paying: boolean;
  payError: unknown;
  lastPurchase: Purchase | null;
  linking: BindOnly | null;
  trialMethod: MethodId | null;
  trialBlocked: TrialBlock | null;
  askTrial: boolean;
}

export interface FlowInit {
  intent: StarIntent | null;
  plan: string | null;
  offerId: string | null;
  premium: boolean;
}

function firstStep(intent: StarIntent | null, premium: boolean): Step {
  if (intent === 'invite') return 'invite';
  if (intent === 'confirm') return 'manage';
  if (intent === 'trial' && !premium) return 'trial';
  if (intent) return 'overview';
  return premium ? 'manage' : 'overview';
}

export type FlowStore = StoreApi<FlowState>;

export function createFlowStore(init: FlowInit): FlowStore {
  return createStore<FlowState>(() => ({
    step: firstStep(init.intent, init.premium),
    tier: 'solo',
    recipient: init.intent === 'gift' ? 'gift' : 'self',
    planId: init.plan,
    methodId: null,
    renewPref: null,
    refBonus: null,
    offerId: init.offerId,
    checkout: null,
    paying: false,
    payError: null,
    lastPurchase: null,
    linking: null,
    trialMethod: null,
    trialBlocked: null,
    askTrial: false,
  }));
}

export const FlowContext = createContext<FlowStore | null>(null);

export function useFlowStore(): FlowStore {
  const store = useContext(FlowContext);
  if (!store) throw new Error('STAR flow store is missing');
  return store;
}

export function useFlow<T>(selector: (state: FlowState) => T): T {
  return useStore(useFlowStore(), selector);
}

export const isGift = (s: FlowState) => s.recipient === 'gift' && s.tier === 'solo';
