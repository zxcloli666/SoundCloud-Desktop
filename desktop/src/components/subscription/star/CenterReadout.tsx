import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2 } from '../../../lib/icons';
import type { Plan } from '../../../lib/pay-client';
import { daysUntil, passDate, passSerial, usd } from '../../../lib/star-format';
import type { PayPhase } from '../PayStatus';
import type { Currency } from '../providers';
import { monthsKey, type Step } from './meta';

// Layered shadow: a tight dark halo keeps the display glyphs crisp over the
// core's bloom, plus soft depth so the muted meta line reads too.
const SHADOW = {
  textShadow: '0 0 1px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.92), 0 3px 26px rgba(0,0,0,0.8)',
} as const;
// Geometric techno-display (Unbounded), scoped via --font-serif on /star.
const DISP = { fontFamily: 'var(--font-serif)', ...SHADOW } as const;
// Console mono (Geist Mono) — the ₽ unit; compact, full cyrillic + ₽ coverage.
const MONO = { fontFamily: 'var(--font-mono)', ...SHADOW } as const;

// One shared anatomy for every state: accent Eyebrow → big Hero → muted Caption.
// Keeps price / identity / status readouts in the same rhythm and on the same
// typography (no per-state divergence).

/** Accent mark above the hero. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-[17px] leading-none text-accent" style={SHADOW}>
      {children}
    </div>
  );
}

/** The big Unbounded hero — a price number or the @handle — + optional unit. */
function Hero({ children, unit, size }: { children: ReactNode; unit?: ReactNode; size: number }) {
  return (
    <div className="mt-1.5 flex items-center justify-center gap-2">
      <span
        className="break-words font-bold leading-[0.95] tracking-[-0.03em] text-ink"
        style={{ ...DISP, fontSize: size }}
      >
        {children}
      </span>
      {unit != null && (
        <span className="text-ink-50" style={{ ...MONO, fontSize: Math.round(size * 0.4) }}>
          {unit}
        </span>
      )}
    </div>
  );
}

function priceOf(plan: Plan | null, currency: Currency) {
  if (!plan) return { amount: '—', unit: '₽', perMonth: '' };
  const cents = currency === 'USD' ? plan.price_usd_cents : undefined;
  if (cents != null) {
    return { amount: usd(cents), unit: undefined, perMonth: usd(Math.round(cents / plan.months)) };
  }
  return {
    amount: `${plan.price_rub}`,
    unit: '₽',
    perMonth: `${Math.round(plan.price_rub / plan.months)} ₽`,
  };
}

/** Secondary line under the hero — one style for price / validity / status. */
function Caption({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 text-[13px] font-medium tracking-[0.01em] text-ink-75" style={SHADOW}>
      {children}
    </div>
  );
}

/** The content that lives inside the living core's dark "well", per flow state. */
export const CenterReadout = memo(function CenterReadout({
  step,
  phase,
  handle,
  plan,
  currency,
  endsAt,
  serialSeed,
  gift,
  inviteDays,
  seats,
}: {
  step: Step;
  phase: PayPhase;
  handle: string;
  plan: Plan | null;
  currency: Currency;
  endsAt: number;
  serialSeed: string;
  gift: boolean;
  inviteDays: number | null;
  seats: { tier: string; used: number; total: number } | null;
}) {
  const { t } = useTranslation();
  const price = priceOf(plan, currency);

  if (step === 'plan' && seats) {
    return (
      <div style={SHADOW}>
        <Eyebrow>✦</Eyebrow>
        <Hero size={46}>{t(`starpass.tier.${seats.tier}`)}</Hero>
        <Caption>
          {t('starpass.shared.centerSeats', { used: seats.used, seats: seats.total })}
        </Caption>
      </div>
    );
  }

  if (step === 'invite') {
    return (
      <div style={SHADOW}>
        <Eyebrow>✦ ✦</Eyebrow>
        <Hero size={60} unit={t('starpass.invite.daysUnit')}>
          {inviteDays != null ? `+${inviteDays}` : '—'}
        </Hero>
        <Caption>{t('starpass.invite.center')}</Caption>
      </div>
    );
  }

  if (step === 'gifts' || (step === 'success' && gift)) {
    return (
      <div style={SHADOW}>
        <Eyebrow>✦</Eyebrow>
        <Hero size={30}>{t(step === 'gifts' ? 'starpass.gift.mine' : 'starpass.gift.ready')}</Hero>
        <Caption>{t('starpass.gift.center')}</Caption>
      </div>
    );
  }

  if (step === 'success' || step === 'manage') {
    return (
      <div style={SHADOW}>
        <Eyebrow>✦</Eyebrow>
        <Hero size={30}>{handle}</Hero>
        {/* membership serial — same display font as the hero, accent + small */}
        <div className="mt-1.5 text-[14px] font-medium tracking-[0.08em] text-accent" style={DISP}>
          {passSerial(serialSeed)}
        </div>
        <Caption>
          {t('starpass.until')} {passDate(endsAt)} ·{' '}
          <span className="font-semibold text-accent">
            {t('starpass.daysLeft', { count: daysUntil(endsAt) })}
          </span>
        </Caption>
      </div>
    );
  }

  if (step === 'pay') {
    return (
      <div style={SHADOW}>
        <Eyebrow>✦</Eyebrow>
        <Hero size={48} unit={plan ? price.unit : undefined}>
          {plan ? price.amount : ''}
        </Hero>
        <Caption>
          <span className="inline-flex items-center gap-2">
            {phase === 'granted' ? (
              <>
                <span className="grid size-[18px] place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-contrast">
                  <Check size={11} strokeWidth={3} />
                </span>
                {t('starpass.status.paid')}
              </>
            ) : phase === 'failed' ? (
              <span className="text-red-300/90">{t('starpass.status.failed')}</span>
            ) : (
              <>
                <Loader2 size={15} className="animate-spin text-accent" />{' '}
                {t('starpass.status.waiting')}
              </>
            )}
          </span>
        </Caption>
      </div>
    );
  }

  if (step === 'redeem') {
    return (
      <div style={SHADOW}>
        <Eyebrow>✦</Eyebrow>
        <Caption>{t('starpass.redeem.center')}</Caption>
      </div>
    );
  }

  // overview / method
  return (
    <div style={SHADOW}>
      <Eyebrow>✦</Eyebrow>
      <Hero size={60} unit={price.unit}>
        {price.amount}
      </Hero>
      <Caption>
        {plan ? (
          <>
            {t(`starpass.plan.${monthsKey(plan.months)}`)} · {price.perMonth}/
            {t('starpass.perMonthShort')}
            {plan.savings_pct > 0 && (
              <span className="font-semibold text-accent"> · −{plan.savings_pct}%</span>
            )}
            {gift && <span className="text-accent"> · {t('starpass.recipient.gift')}</span>}
          </>
        ) : (
          t('starpass.loading')
        )}
      </Caption>
    </div>
  );
});
