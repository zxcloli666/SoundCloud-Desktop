import { useMutation, useQuery } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CORE_CENTER_Y, LivingCore } from '../components/subscription/LivingCore';
import { phaseOf } from '../components/subscription/PayStatus';
import {
  type ActivationOption,
  activationOptions,
  bindOf,
  type ChosenRoute,
  chooseRoute,
  currencyOf,
  type RouteContext,
  renewFor,
  toCheckout,
  usable,
} from '../components/subscription/providers';
import { StarAtmosphere } from '../components/subscription/StarAtmosphere';
import { CenterReadout } from '../components/subscription/star/CenterReadout';
import { CardPane } from '../components/subscription/star/card/CardPane';
import { GIFTS_KEY, GiftsPane } from '../components/subscription/star/GiftsPane';
import { InvitePane, REFERRAL_KEY } from '../components/subscription/star/InvitePane';
import { LegalNote } from '../components/subscription/star/LegalNote';
import { ManagePane } from '../components/subscription/star/ManagePane';
import { MethodPane } from '../components/subscription/star/MethodPane';
import {
  primaryEntitlement,
  type Recipient,
  type Step,
} from '../components/subscription/star/meta';
import { OverviewPane } from '../components/subscription/star/OverviewPane';
import { PayPane } from '../components/subscription/star/PayPane';
import { RedeemPane } from '../components/subscription/star/RedeemPane';
import type { RefBonus } from '../components/subscription/star/RefField';
import { SharedPane } from '../components/subscription/star/SharedPane';
import { Console } from '../components/subscription/star/StarConsole';
import { SuccessPane } from '../components/subscription/star/SuccessPane';
import { SbpPane } from '../components/subscription/star/sbp/SbpPane';
import type { TierOption } from '../components/subscription/star/TierSwitch';
import { bindState } from '../lib/boosty-bind-state';
import { refreshBinds, useBinds, useCardSupported, useRemoveBind } from '../lib/boosty-binds';
import { ChevronLeft } from '../lib/icons';
import {
  type BoostyMethod,
  type CheckoutResp,
  type Plan,
  payApi,
  payErrorCode,
  type SharedTierId,
  type TierId,
} from '../lib/pay-client';
import { usePremium } from '../lib/premium-cache';
import { queryClient } from '../lib/query-client';
import { planPrice } from '../lib/star-format';
import { type StarIntent, usePaySubscription, useStartTrial } from '../lib/star-offer';
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

/**
 * STAR membership — the "living core" instrument. Energy lives in the canvas
 * core; per-state content rides a floating glass console over it. This file is
 * pure orchestration (flow state machine + data wiring); every state's UI lives
 * in `components/subscription/star/*`.
 */
export const StarPage = memo(function StarPage() {
  const location = useLocation();
  const state = location.state as { intent?: StarIntent; plan?: string } | null;
  return (
    <StarFlow key={location.key} intent={state?.intent ?? null} presetPlan={state?.plan ?? null} />
  );
});

function firstStep(intent: StarIntent | null, premium: boolean): Step {
  if (intent === 'invite') return 'invite';
  if (intent) return 'overview';
  return premium ? 'manage' : 'overview';
}

const StarFlow = memo(function StarFlow({
  intent,
  presetPlan,
}: {
  intent: StarIntent | null;
  presetPlan: string | null;
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
  const [planId, setPlanId] = useState<string | null>(presetPlan);
  const [option, setOption] = useState<ActivationOption | null>(null);
  const [renewOn, setRenewOn] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutResp | null>(null);
  const [igniteKey, setIgniteKey] = useState(0);
  const [relink, setRelink] = useState<BoostyMethod | null>(null);

  const plansQuery = useQuery({
    queryKey: ['pay', 'plans'],
    queryFn: payApi.plans,
    staleTime: 300_000,
  });
  const soloPlans = plansQuery.data?.plans ?? [];
  const plans = tierPlans(tier, soloPlans, plansQuery.data?.shared);
  const cardSupported = useCardSupported();
  const routeCtx = useMemo<RouteContext>(
    () => ({ planId, gift, shared: tier !== 'solo', cardSupported }),
    [planId, gift, tier, cardSupported],
  );
  const options = useMemo(
    () =>
      plansQuery.data ? activationOptions(plansQuery.data).filter((o) => usable(o, routeCtx)) : [],
    [plansQuery.data, routeCtx],
  );
  const picked = options.find((o) => o.kind === option?.kind) ?? null;
  const renewRoute = picked ? renewFor(picked, routeCtx) : null;
  const chosen = useMemo(
    () => (picked ? chooseRoute(picked, renewOn, routeCtx) : null),
    [picked, renewOn, routeCtx],
  );
  const bindMethod = chosen?.recurring ? bindOf(chosen.route) : null;
  const binds = useBinds(bindMethod !== null);
  const removeBind = useRemoveBind();
  const bindNow = bindMethod ? bindState(binds.data, bindMethod) : 'none';
  const bound = bindMethod
    ? binds.data
      ? bindNow === 'linked'
      : binds.isError
        ? false
        : null
    : null;
  const relinking = step === 'card' || step === 'sbp' ? relink : null;
  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const routeCurrency = currencyOf(chosen?.route);
  const amount = selectedPlan ? planPrice(selectedPlan, routeCurrency) : '';
  const sharedOverview = useSharedOverview().data;
  const preview = useSharedPreview(tier, planId, premium);
  const tierOptions = useMemo<TierOption[]>(() => {
    const soloPlan = soloPlans.find((p) => p.id === planId);
    const shared = plansQuery.data?.shared ?? [];
    return [
      { id: 'solo', people: 1, each: soloPlan?.price_rub ?? 0, savePct: 0 },
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
    checkout?.expires_at ?? null,
  );
  const phase = phaseOf(order.data?.status);
  if (step === 'pay' && phase === 'granted') {
    setIgniteKey((k) => k + 1);
    setStep('success');
    if (tier !== 'solo') refreshShared();
    if (order.data?.gift) void queryClient.invalidateQueries({ queryKey: GIFTS_KEY });
  }
  const giftResult =
    order.data?.gift && order.data.gift_code
      ? { code: order.data.gift_code, periodDays: selectedPlan?.period_days ?? 30 }
      : null;

  // Active-membership end date (manage/success centre readout) — comes from the
  // subscription, not the in-flight order. Shared cache with ManagePane.
  const subQuery = usePaySubscription();
  const status = useStarStatus();
  const trialAvailable = !premium && subQuery.data?.trial_available === true;
  const referral = useQuery({
    queryKey: REFERRAL_KEY,
    queryFn: payApi.referral,
    staleTime: 60_000,
    enabled: step === 'invite',
  });
  const inviteDays = referral.data?.bonus_days ?? null;

  const { mutate: mutateTrial, isPending: trialPending } = useStartTrial();
  const startTrial = useCallback(() => {
    mutateTrial(undefined, {
      onSuccess: () => {
        setIgniteKey((k) => k + 1);
        setStep('success');
      },
      onError: (e) => {
        const code = payErrorCode(e);
        const known = code === 'trial_used' || code === 'not_eligible';
        toast.error(t(`starpass.trial.error.${known ? code : 'failed'}`));
      },
    });
  }, [mutateTrial, t]);
  const trialAsked = useRef(false);
  useEffect(() => {
    if (intent !== 'trial' || trialAsked.current || !trialAvailable) return;
    trialAsked.current = true;
    startTrial();
  }, [intent, trialAvailable, startTrial]);
  const subEndsAt = subQuery.data
    ? (primaryEntitlement(subQuery.data.entitlements)?.ends_at ?? subQuery.data.premium_until ?? 0)
    : 0;
  const centerEndsAt = step === 'manage' ? subEndsAt : (order.data?.premium_until ?? subEndsAt);

  const checkoutMut = useMutation({
    mutationFn: (route: ChosenRoute) => {
      if (!planId) throw new Error('no plan');
      return payApi.checkout({
        ...toCheckout(route, planId),
        gift: gift || undefined,
        tier: tier === 'solo' ? undefined : (tier as SharedTierId),
        ref: !gift && refBonus ? refBonus.code : undefined,
      });
    },
    onSuccess: (resp) => {
      setCheckout(resp);
      setStep('pay');
    },
    onError: (_error, route) => {
      if (step === 'pay') setStep('method');
      if (bindOf(route.route)) refreshBinds();
    },
  });
  const checkoutError = checkoutMut.isError
    ? t(
        payErrorCode(checkoutMut.error)
          ? sharedErrorKey(checkoutMut.error)
          : 'starpass.checkoutError',
      )
    : null;
  const lastRoute = checkoutMut.variables;
  const refreshQr = useCallback(() => {
    if (lastRoute) checkoutMut.mutate(lastRoute);
  }, [checkoutMut.mutate, lastRoute]);

  const reset = useCallback(() => {
    setCheckout(null);
    checkoutMut.reset();
  }, [checkoutMut]);

  const goMethod = useCallback(() => {
    reset();
    setStep('method');
  }, [reset]);

  const payChosen = useCallback(() => {
    setStep('method');
    if (chosen) checkoutMut.mutate(chosen);
  }, [chosen, checkoutMut.mutate]);

  const onceRoute = picked?.once ?? null;
  const payOnce = useMemo(
    () =>
      onceRoute
        ? () => {
            setRenewOn(false);
            setStep('method');
            checkoutMut.mutate({ route: onceRoute, recurring: false });
          }
        : null,
    [onceRoute, checkoutMut.mutate],
  );

  const startRelink = useCallback((method: BoostyMethod) => {
    setRelink(method);
    setStep(method === 'sbp' ? 'sbp' : 'card');
  }, []);

  const endRelink = useCallback(() => {
    setRelink(null);
    refreshBinds();
    setStep('manage');
  }, []);

  const continueToPay = useCallback(() => {
    if (!chosen) return;
    setRelink(null);
    if (bindMethod && bound !== true) {
      setStep(bindMethod === 'sbp' ? 'sbp' : 'card');
      return;
    }
    checkoutMut.mutate(chosen);
  }, [chosen, bindMethod, bound, checkoutMut.mutate]);

  const lit = step === 'success' || step === 'manage' || relinking !== null;
  // Where the header "back" returns to, per step (null = no back button).
  const backTarget: Step | null = relinking
    ? 'manage'
    : step === 'pay' || step === 'card' || step === 'sbp'
      ? 'method'
      : step === 'method'
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
                  step={relinking ? 'manage' : step}
                  phase={phase}
                  handle={handle}
                  plan={selectedPlan}
                  currency={
                    step === 'pay'
                      ? checkout?.currency === 'USD'
                        ? 'USD'
                        : 'RUB'
                      : step === 'overview'
                        ? 'RUB'
                        : routeCurrency
                  }
                  endsAt={centerEndsAt}
                  status={status}
                  serialSeed={checkout?.order_id ?? handle}
                  gift={gift}
                  inviteDays={inviteDays}
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
                trial={trialAvailable}
                trialPending={trialPending}
                onTrial={startTrial}
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
                onSelect={setOption}
                renew={{
                  available: renewRoute !== null,
                  forced: renewRoute !== null && !picked?.once,
                  on: chosen?.recurring === true,
                  periodDays: renewRoute?.period_days ?? null,
                  otherProvider:
                    !!renewRoute && !!picked?.once && renewRoute.provider !== picked.once.provider,
                }}
                onRenew={setRenewOn}
                bind={
                  bindMethod
                    ? {
                        method: bindMethod,
                        bound,
                        rebind: bindNow === 'rebind',
                        removing: removeBind.isPending,
                        onRemove: () => removeBind.mutate(bindMethod),
                      }
                    : null
                }
                amount={amount}
                pending={checkoutMut.isPending}
                error={checkoutError}
                onOnce={bindMethod && checkoutMut.isError ? payOnce : null}
                onContinue={continueToPay}
              />
            )}
            {step === 'card' && (
              <CardPane
                method={(relinking ?? bindMethod) === 'card_usd' ? 'card_usd' : 'card'}
                amount={relinking ? null : amount}
                onLinked={relinking ? endRelink : payChosen}
                onOnce={relinking ? null : payOnce}
                onBack={relinking ? endRelink : goMethod}
              />
            )}
            {step === 'sbp' && (
              <SbpPane
                paying={!relinking}
                onLinked={relinking ? endRelink : payChosen}
                onOnce={relinking ? null : payOnce}
                onBack={relinking ? endRelink : goMethod}
              />
            )}
            {step === 'pay' && checkout && option && (
              <PayPane
                checkout={checkout}
                option={option}
                phase={phase}
                onChangeMethod={goMethod}
                onRefresh={refreshQr}
                onOnce={payOnce}
              />
            )}
            {(step === 'method' || step === 'card' || step === 'sbp' || step === 'pay') && (
              <LegalNote />
            )}
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
                onRelink={startRelink}
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
