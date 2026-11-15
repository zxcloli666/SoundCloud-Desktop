import { memo, useCallback } from 'react';
import { usePremium } from '../../../../lib/premium-cache';
import { CardPane } from '../card/CardPane';
import { purchaseNow, useBuying, useEnv, useFlowApi, useLinking, useSel } from '../flow/derive';
import { amountOf, canOnceOf, pickedOf } from '../flow/select';
import { useFlowStore } from '../flow/store';
import { LegalNote } from '../LegalNote';
import type { Step } from '../meta';
import { SbpPane } from '../sbp/SbpPane';
import { TrialPane } from '../trial/TrialPane';
import { Panel } from '../ui/Panel';
import { GiftsStep } from './GiftsStep';
import { InviteStep } from './InviteStep';
import { RedeemStep } from './RedeemStep';
import { SharedStep } from './SharedStep';

export const DeepStep = memo(function DeepStep({ step }: { step: Step }) {
  const buying = useBuying();
  const premium = usePremium();
  const legal = !buying && premium && (step === 'card' || step === 'sbp' || step === 'trial');
  return (
    <Panel data-ui="star-step" step={step}>
      {(step === 'card' || step === 'sbp') && <LinkStep step={step} />}
      {step === 'trial' && <TrialPane />}
      {step === 'plan' && <SharedStep />}
      {step === 'redeem' && <RedeemStep />}
      {step === 'invite' && <InviteStep />}
      {step === 'gifts' && <GiftsStep />}
      {legal && <LegalNote />}
    </Panel>
  );
});

const LinkStep = memo(function LinkStep({ step }: { step: 'card' | 'sbp' }) {
  const linking = useLinking();
  const picked = useSel((s, e) => pickedOf(s, e)?.id ?? null);
  const amount = useSel(amountOf);
  const once = useSel(canOnceOf);
  const store = useFlowStore();
  const env = useEnv();
  const api = useFlowApi();
  const pay = useCallback(() => {
    const purchase = purchaseNow(store.getState(), env);
    if (purchase) api.payNow(purchase);
  }, [store, env, api]);
  const payOnce = useCallback(() => {
    const purchase = purchaseNow(store.getState(), env);
    if (purchase) api.payOnce(purchase);
  }, [store, env, api]);
  const props = {
    method: linking?.method ?? picked ?? (step === 'sbp' ? 'sbp' : 'card_ru'),
    trial: linking?.trial,
    onLinked: linking ? api.endLink : pay,
    onOnce: linking || !once ? null : payOnce,
    onBack: linking ? api.leaveLink : api.goMethod,
  } as const;
  return step === 'card' ? (
    <CardPane {...props} amount={linking ? null : amount} />
  ) : (
    <SbpPane {...props} paying={!linking} />
  );
});
