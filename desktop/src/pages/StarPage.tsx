import { useMutation, useQuery } from '@tanstack/react-query';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CORE_CENTER_Y, LivingCore } from '../components/subscription/LivingCore';
import {
  chooseRoute,
  currencyOf,
  hasOnce,
  payMethods,
  type RouteContext,
  renewable,
  tileOf,
  usable,
} from '../components/subscription/methods';
import { phaseOf } from '../components/subscription/PayStatus';
import { StarAtmosphere } from '../components/subscription/StarAtmosphere';
import { CenterReadout } from '../components/subscription/star/CenterReadout';
import { CardPane } from '../components/subscription/star/card/CardPane';
import { GIFTS_KEY, GiftsPane } from '../components/subscription/star/GiftsPane';
import { InvitePane, REFERRAL_KEY } from '../components/subscription/star/InvitePane';
import { LegalNote } from '../components/subscription/star/LegalNote';
import { ManagePane } from '../components/subscription/star/ManagePane';
import { MethodPane } from '../components/subscription/star/MethodPane';
import { primarySource, type Recipient, type Step } from '../components/subscription/star/meta';
import { OfferBanner } from '../components/subscription/star/OfferBanner';
import { OverviewPane } from '../components/subscription/star/OverviewPane';
import { PayPane } from '../components/subscription/star/PayPane';
import { RedeemPane } from '../components/subscription/star/RedeemPane';
import type { RefBonus } from '../components/subscription/star/RefField';
import { SharedPane } from '../components/subscription/star/SharedPane';
import { Console } from '../components/subscription/star/StarConsole';
import { SuccessPane } from '../components/subscription/star/SuccessPane';
import { SbpPane } from '../components/subscription/star/sbp/SbpPane';
import type { TierOption } from '../components/subscription/star/TierSwitch';
import { TrialPane } from '../components/subscription/star/trial/TrialPane';
import { useTrialStep } from '../components/subscription/star/trial/useTrialStep';
import { useBindOnly } from '../components/subscription/star/useBindOnly';
import { useOfferCheckout } from '../components/subscription/star/useOfferCheckout';
import { bindOf, refreshBinds, useBinds, usePlans, useRemoveBind } from '../lib/binds';
import { ChevronLeft } from '../lib/icons';
import {
  type BindFlow,
  type MethodId,
  type Order,
  type Plan,
  payApi,
  payErrorCode,
  type Renewal,
  type TierId,
} from '../lib/pay-client';
import { usePremium } from '../lib/premium-cache';
import { queryClient } from '../lib/query-client';
import { planPrice } from '../lib/star-format';
import { type StarIntent, usePaySubscription } from '../lib/star-offer';
import {
  perPerson,
  refreshShared,
  sharedErrorKey,
  tierPlans,
  useSharedOverview,
  useSharedPreview,
} from '../lib/star-shared';
import { useStarStatus } from '../lib/star-status';
import { useOrderPoll } from '../lib/useOrderPoll';
import { useAuthStore } from '../stores/auth';

const DAY_SECS = 86_400;
const NEEDS_LINK = new Set(['bind_needed', 'relink']);

/**
 * STAR membership — the "living core" instrument. Energy lives in the canvas
 * core; per-state content rides a floating glass console over it. This file is
 * pure orchestration (flow state machine + data wiring); every state's UI lives
 * in `components/subscription/star/*`.
 */
export const StarPage = memo(function StarPage() {
  const location = useLocation();
  const state = location.state as { intent?: StarIntent; plan?: string; offer?: string } | null;
  return (
    <StarFlow
      key={location.key}
      intent={state?.intent ?? null}
      presetPlan={state?.plan ?? null}
      offerId={state?.offer ?? null}
    />
  );
});

function firstStep(intent: StarIntent | null, premium: boolean): Step {
  if (intent === 'invite') return 'invite';
  if (intent === 'confirm') return 'manage';
  if (intent === 'trial' && !premium) return 'trial';
  if (intent) return 'overview';
  return premium ? 'manage' : 'overview';
}

interface Purchase {
  planId: string;
  method: MethodId;
  recurring: boolean;
  own: boolean;
}

const StarFlow = memo(function StarFlow({
  intent,
  presetPlan,
  offerId,
}: {
  intent: StarIntent | null;
  presetPlan: string | null;
  offerId: string | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const premium = usePremium();
  const username = useAuthStore((s) => s.user?.username);
  const handle = username ? `@${username}` : t('starpass.guestHandle');

  const [step, setStep] = useState<Step>(() => firstStep(intent, premium));
  const [tier, setTier] = useState<TierId>('solo');
  const [recipient, setRecipient] = useState<Recipient>(intent === 'gift' ? 'gift' : 'self');
  const [refBonus, setRefBonus] = useState<RefBonus>(null);
  const gift = recipient === 'gift' && tier === 'solo';
  const [pickedPlan, setPlanId] = useState<string | null>(presetPlan);
  const offerCo = useOfferCheckout(offerId, !gift && tier === 'solo');
  const planId = offerCo.offer?.plan_id ?? pickedPlan;
  const [methodId, setMethodId] = useState<MethodId | null>(null);
  const [renewPref, setRenewPref] = useState<boolean | null>(null);
  const [checkout, setCheckout] = useState<Order | null>(null);
  const [igniteKey, setIgniteKey] = useState(0);

  const plansQuery = usePlans();
  const soloPlans = plansQuery.data?.plans ?? [];
  const plans = offerCo.plans(tierPlans(tier, soloPlans, plansQuery.data?.shared));
  const routeCtx = useMemo<RouteContext>(
    () => ({ planId, gift, shared: tier !== 'solo' }),
    [planId, gift, tier],
  );
  const allMethods = useMemo(
    () => (plansQuery.data ? payMethods(plansQuery.data) : []),
    [plansQuery.data],
  );
  const options = useMemo(
    () => offerCo.methods(allMethods.filter((m) => usable(m, routeCtx))),
    [allMethods, routeCtx, offerCo.methods],
  );
  const picked = options.find((m) => m.id === methodId) ?? null;
  const route = useMemo(
    () => (picked ? chooseRoute(picked, offerCo.bind ? true : renewPref, routeCtx) : null),
    [picked, renewPref, routeCtx, offerCo.bind],
  );
  const viaBind = route?.viaBind === true && !!picked?.bind;
  const binds = useBinds(viaBind);
  const removeBind = useRemoveBind();
  const bindView = viaBind && picked ? bindOf(binds.data, picked.id) : null;
  const bindState = viaBind
    ? binds.data
      ? (bindView?.state ?? 'none')
      : binds.isError
        ? 'none'
        : null
    : null;
  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const routeCurrency = currencyOf(route);
  const amount = selectedPlan ? planPrice(selectedPlan, routeCurrency) : '';
  const periodDays = picked?.period_days ?? selectedPlan?.period_days ?? 30;
  const sharedOverview = useSharedOverview().data;
  const preview = useSharedPreview(tier, planId, premium);
  const tierOptions = useMemo<TierOption[]>(() => {
    const soloPlan = soloPlans.find((p) => p.id === planId);
    const shared = plansQuery.data?.shared ?? [];
    return [
      { id: 'solo', people: 1, each: soloPlan?.price.RUB ?? 0, savePct: 0 },
      ...shared.map((s) => {
        const pp = perPerson(
          s.plans.find((p) => p.id === planId),
          soloPlan,
          s.seats,
        );
        return { id: s.tier, people: s.seats + 1, ...pp };
      }),
    ];
  }, [plansQuery.data, soloPlans, planId]);
  const changeTier = useCallback((next: TierId) => {
    setTier(next);
    if (next !== 'solo') setRecipient('self');
  }, []);

  // auto-pick the best-value plan once plans arrive
  const bestId = plans.reduce<Plan | null>(
    (b, p) => (!b || p.savings_pct > b.savings_pct ? p : b),
    null,
  )?.id;
  if (!planId && bestId) setPlanId(bestId);

  const order = useOrderPoll(
    step === 'pay' || step === 'success' ? (checkout?.order_id ?? null) : null,
    checkout?.action?.type === 'qr' || checkout?.action?.type === 'open'
      ? checkout.expires_at
      : null,
  );
  const current = order.data ?? checkout;
  const phase = phaseOf(current?.status);
  if (step === 'pay' && phase === 'granted') {
    setIgniteKey((k) => k + 1);
    setStep('success');
    if (tier !== 'solo') refreshShared();
    if (current?.gift) void queryClient.invalidateQueries({ queryKey: GIFTS_KEY });
  }
  const giftResult =
    current?.gift && current.gift_code
      ? { code: current.gift_code, periodDays: selectedPlan?.period_days ?? 30 }
      : null;

  // Active-membership end date (manage/success centre readout) — comes from the
  // subscription, not the in-flight order. Shared cache with ManagePane.
  const subQuery = usePaySubscription();
  const status = useStarStatus();
  const referral = useQuery({
    queryKey: REFERRAL_KEY,
    queryFn: payApi.referral,
    staleTime: 60_000,
    enabled: step === 'invite',
  });
  const inviteDays = referral.data?.bonus_days ?? null;

  const grantTrial = useCallback(() => {
    setIgniteKey((k) => k + 1);
    setStep('success');
  }, []);
  const trial = useTrialStep(premium, soloPlans, allMethods, setStep, grantTrial);
  const bindOnly = useBindOnly(step, setStep, trial.done);
  const linking = bindOnly.linking;
  const relinking = linking && !linking.trial;
  const subEndsAt = subQuery.data
    ? (primarySource(subQuery.data.sources)?.ends_at ?? subQuery.data.premium_until ?? 0)
    : 0;
  const centerEndsAt = step === 'manage' ? subEndsAt : (current?.premium_until ?? subEndsAt);

  const checkoutMut = useMutation({
    mutationFn: (p: Purchase) =>
      payApi.checkout({
        plan_id: p.planId,
        method: p.method,
        recurring: p.recurring,
        idempotency_key: crypto.randomUUID(),
        gift: (p.own && gift) || undefined,
        tier: p.own && tier !== 'solo' ? tier : undefined,
        ref: p.own && !gift && !offerCo.offer && refBonus ? refBonus.code : undefined,
        offer_id: p.own ? offerCo.offer?.id : undefined,
      }),
    onSuccess: (resp) => {
      setCheckout(resp);
      setStep('pay');
    },
    onError: (error, p) => {
      if (step === 'pay') setStep('method');
      if (NEEDS_LINK.has(payErrorCode(error) ?? '')) refreshBinds();
      if (p.own) return;
      setStep('manage');
      toast.error(t(payErrorCode(error) ? sharedErrorKey(error) : 'starpass.checkoutError'));
    },
  });
  const checkoutError = checkoutMut.isError
    ? t(
        payErrorCode(checkoutMut.error)
          ? sharedErrorKey(checkoutMut.error)
          : 'starpass.checkoutError',
      )
    : null;
  const lastPurchase = checkoutMut.variables;
  const refreshQr = useCallback(() => {
    if (lastPurchase) checkoutMut.mutate(lastPurchase);
  }, [checkoutMut.mutate, lastPurchase]);

  const reset = useCallback(() => {
    setCheckout(null);
    checkoutMut.reset();
  }, [checkoutMut]);

  const goMethod = useCallback(() => {
    reset();
    setStep('method');
  }, [reset]);

  const relinkAndPay = useCallback(() => {
    refreshBinds();
    goMethod();
  }, [goMethod]);

  const purchase = useMemo<Purchase | null>(
    () =>
      route && planId
        ? { planId, method: route.method.id, recurring: route.recurring, own: true }
        : null,
    [route, planId],
  );

  const payChosen = useCallback(() => {
    setStep('method');
    if (purchase) checkoutMut.mutate(purchase);
  }, [purchase, checkoutMut.mutate]);

  const canOnce = !!picked && hasOnce(picked) && !offerCo.bind;
  const payOnce = useMemo(
    () =>
      canOnce && picked && planId
        ? () => {
            setRenewPref(false);
            setStep('method');
            checkoutMut.mutate({ planId, method: picked.id, recurring: false, own: true });
          }
        : null,
    [canOnce, picked, planId, checkoutMut.mutate],
  );

  const continueToPay = useCallback(() => {
    if (!purchase || !picked) return;
    bindOnly.clear();
    if (viaBind && bindState !== 'linked') {
      setStep(picked.bind?.flow === 'qr' ? 'sbp' : 'card');
      return;
    }
    checkoutMut.mutate(purchase);
  }, [purchase, picked, viaBind, bindState, checkoutMut.mutate, bindOnly.clear]);

  const confirmRenewal = useCallback(
    async (renewal: Renewal) => {
      const loaded =
        plansQuery.data ??
        (await queryClient
          .fetchQuery({ queryKey: ['pay', 'plans'], queryFn: payApi.plans })
          .catch(() => null));
      const solo = loaded?.plans ?? [];
      const plan =
        solo.find((p) => p.period_days === renewal.period_days) ?? solo.find((p) => p.months === 1);
      if (!plan) {
        toast.error(t('starpass.checkoutError'));
        return;
      }
      setTier('solo');
      setRecipient('self');
      setPlanId(plan.id);
      setMethodId(renewal.method);
      checkoutMut.mutate({ planId: plan.id, method: renewal.method, recurring: true, own: false });
    },
    [plansQuery.data, checkoutMut.mutate, t],
  );

  const flowOf = useCallback(
    (method: MethodId): BindFlow =>
      allMethods.find((m) => m.id === method)?.bind?.flow ?? 'card_form',
    [allMethods],
  );

  const lit = step === 'success' || step === 'manage' || !!relinking;
  // Where the header "back" returns to, per step (null = no back button).
  const backTarget: Step | null = linking
    ? linking.trial
      ? 'trial'
      : 'manage'
    : step === 'pay' || step === 'card' || step === 'sbp'
      ? 'method'
      : step === 'method' || step === 'trial'
        ? 'overview'
        : step === 'redeem' || step === 'invite' || step === 'gifts' || step === 'plan'
          ? premium
            ? 'manage'
            : 'overview'
          : step === 'overview' && premium
            ? 'manage'
            : null;
  // Active membership = the core fully open (max charge), like the 12-mo plan —
  // regardless of which plan is selected behind the scenes.
  const charge = lit
    ? 1
    : selectedPlan
      ? selectedPlan.months >= 12
        ? 1
        : selectedPlan.months >= 3
          ? 0.6
          : 0.28
      : 0.5;

  return (
    <div data-ui="page" data-page="star" className="relative min-h-full w-full">
      <StarAtmosphere />
      <div
        className="relative z-10 mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-[1060px] flex-col px-4 md:px-8"
        style={
          {
            isolation: 'isolate',
            // Scope the editorial display pair to /star only (no app-wide blast):
            // every `font-mono` / `var(--font-serif)` inside inherits these.
            '--font-serif': 'var(--font-display)',
            '--font-mono': 'var(--font-mono-console)',
          } as React.CSSProperties
        }
      >
        {/* frozen header — pinned so you can always go back / change the term */}
        <div className="sticky top-0 z-30 flex items-center justify-between py-4">
          <div className="flex items-center gap-2.5 font-mono text-[12px] uppercase tracking-[0.34em] text-ink-60">
            <span className="text-accent">✦</span> STAR
          </div>
          {backTarget && (
            <button
              type="button"
              onClick={() => backTarget && setStep(backTarget)}
              className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-ink-45 transition-colors hover:text-ink-90"
            >
              <ChevronLeft size={14} /> {t('starpass.back')}
            </button>
          )}
        </div>

        {/* core region — flex-1 so the star centres and shrinks with the viewport */}
        <div className="relative flex min-h-[240px] flex-1">
          {/* living core backdrop */}
          <LivingCore
            charge={charge}
            waiting={step === 'pay' && phase === 'waiting'}
            lit={lit}
            igniteKey={igniteKey}
          />

          {/* aperture centre readout — dark lens scrim keeps it readable even when
              the lit core is at its brightest */}
          <div
            className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ top: `${CORE_CENTER_Y * 100}%` }}
          >
            <div className="relative px-10 py-8 text-center">
              {/* single clean dark lens — darker core, smooth feather, sized a hair
                  larger than the text so glyphs never sit on the blurry edge (kills
                  the doubled-scrim smear; the canvas well underneath stays subtle). */}
              <div
                aria-hidden
                className="absolute -inset-x-8 -inset-y-5"
                style={{
                  background:
                    'radial-gradient(58% 54% at 50% 50%, rgb(var(--paper) / 0.95) 0%, rgb(var(--paper) / 0.86) 40%, rgb(var(--paper) / 0.42) 68%, transparent 86%)',
                }}
              />
              <div className="relative mx-auto max-w-[320px]">
                <CenterReadout
                  step={linking ? (linking.trial ? 'trial' : 'manage') : step}
                  phase={phase}
                  handle={handle}
                  plan={selectedPlan}
                  currency={
                    step === 'pay'
                      ? (checkout?.currency ?? 'RUB')
                      : step === 'overview'
                        ? 'RUB'
                        : routeCurrency
                  }
                  endsAt={centerEndsAt}
                  status={status}
                  serialSeed={checkout?.order_id ?? handle}
                  gift={gift}
                  inviteDays={inviteDays}
                  trial={
                    trial.offer?.available ? { days: trial.offer.days, amount: trial.amount } : null
                  }
                  seats={
                    sharedOverview?.owner
                      ? {
                          tier: sharedOverview.owner.tier,
                          used: sharedOverview.owner.members.length,
                          total: sharedOverview.owner.seats,
                        }
                      : null
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* console — in normal flow beneath the core, can never overlap it */}
        <div className="relative z-20 mx-auto w-full max-w-[700px] pb-6 pt-3">
          <Console>
            {offerCo.offer && (step === 'overview' || step === 'method') && (
              <OfferBanner offer={offerCo.offer} />
            )}
            {step === 'overview' && (
              <OverviewPane
                plans={plans}
                loading={plansQuery.isLoading}
                error={plansQuery.isError}
                onRetry={() => void plansQuery.refetch()}
                selectedId={planId}
                onSelect={setPlanId}
                onIgnite={goMethod}
                onRedeem={() => setStep('redeem')}
                recipient={recipient}
                onRecipient={setRecipient}
                trialDays={trial.offer?.available ? trial.offer.days : null}
                onTrial={trial.open}
                refCode={refBonus}
                onRefCode={setRefBonus}
                showRef={!premium}
                onInvite={() => setStep('invite')}
                tier={tier}
                tierOptions={tierOptions}
                onTier={changeTier}
                isMember={sharedOverview?.role === 'member'}
                preview={preview.data}
              />
            )}
            {step === 'method' && (
              <MethodPane
                options={options}
                selected={picked}
                onSelect={(m) => setMethodId(m.id)}
                renew={{
                  available: !!picked && renewable(picked, routeCtx) && !offerCo.bind,
                  on: route?.recurring === true,
                  periodDays,
                  nextAt: Math.floor(Date.now() / 1000) + periodDays * DAY_SECS,
                  charge: amount,
                  ownLink: !!picked?.bind && canOnce,
                }}
                onRenew={setRenewPref}
                bind={
                  viaBind && picked?.bind
                    ? {
                        method: picked.id,
                        flow: picked.bind.flow,
                        state: bindState,
                        oneOff: route?.recurring === false,
                        removing: removeBind.isPending,
                        onRemove: () => removeBind.mutate(picked.id),
                      }
                    : null
                }
                amount={amount}
                pending={checkoutMut.isPending}
                error={checkoutError}
                onOnce={viaBind && checkoutMut.isError ? payOnce : null}
                onContinue={continueToPay}
              />
            )}
            {step === 'card' && (
              <CardPane
                method={linking?.method ?? picked?.id ?? 'card_ru'}
                amount={linking ? null : amount}
                trial={linking?.trial}
                onLinked={linking ? bindOnly.end : payChosen}
                onOnce={linking ? null : payOnce}
                onBack={linking ? bindOnly.leave : goMethod}
              />
            )}
            {step === 'sbp' && (
              <SbpPane
                method={linking?.method ?? picked?.id ?? 'sbp'}
                paying={!linking}
                trial={linking?.trial}
                onLinked={linking ? bindOnly.end : payChosen}
                onOnce={linking ? null : payOnce}
                onBack={linking ? bindOnly.leave : goMethod}
              />
            )}
            {step === 'trial' && (
              <TrialPane
                offer={trial.offer}
                loading={trial.loading}
                method={trial.method}
                amount={trial.amount}
                blocked={trial.blocked}
                onPick={trial.pick}
                onLink={(method) => bindOnly.start(method, flowOf(method), true)}
                onBuy={() => setStep('overview')}
              />
            )}
            {step === 'pay' && checkout && current && (
              <PayPane
                first={checkout}
                order={current}
                tile={tileOf(checkout.method)}
                phase={phase}
                onChangeMethod={goMethod}
                onRefresh={refreshQr}
                onOnce={payOnce}
                onRelink={relinkAndPay}
              />
            )}
            {(step === 'method' ||
              step === 'card' ||
              step === 'sbp' ||
              step === 'pay' ||
              step === 'trial') && <LegalNote />}
            {step === 'success' && (
              <SuccessPane
                onMusic={() => navigate('/home')}
                onManage={() => setStep('manage')}
                gift={giftResult}
                onGifts={() => setStep('gifts')}
                onPlan={tier === 'solo' ? undefined : () => setStep('plan')}
              />
            )}
            {step === 'manage' && (
              <ManagePane
                onExtend={() => {
                  setRecipient('self');
                  setStep('overview');
                }}
                onRedeem={() => setStep('redeem')}
                onGift={() => setStep('gifts')}
                onInvite={() => setStep('invite')}
                onPlan={() => setStep('plan')}
                onLink={(method, flow) => bindOnly.start(method, flow, false)}
                onConfirm={confirmRenewal}
                confirming={checkoutMut.isPending}
                onTrialEnded={() => setStep('overview')}
              />
            )}
            {step === 'plan' && <SharedPane onChoose={() => setStep('overview')} />}
            {step === 'redeem' && <RedeemPane onRedeemed={() => setStep('manage')} />}
            {step === 'invite' && <InvitePane />}
            {step === 'gifts' && (
              <GiftsPane
                onGiftMore={() => {
                  setRecipient('gift');
                  setStep('overview');
                }}
              />
            )}
          </Console>
        </div>
      </div>
    </div>
  );
});

export default StarPage;
