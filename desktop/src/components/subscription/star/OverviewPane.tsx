import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Gift, RefreshCw } from '../../../lib/icons';
import type { Plan, SharedPreview, TierId } from '../../../lib/pay-client';
import { passDate } from '../../../lib/star-format';
import { TRIAL_DAYS } from '../../../lib/star-offer';
import { monthsKey, type Recipient } from './meta';
import { PerkGrid } from './PerkGrid';
import { RecipientSwitch } from './RecipientSwitch';
import { type RefBonus, RefField } from './RefField';
import { GhostBtn, LinkBtn, PrimaryBtn } from './StarConsole';
import { type TierOption, TierSwitch } from './TierSwitch';

/** Overview: who it is for, a plan duration, the perks; ignite, try, redeem or invite. */
export const OverviewPane = memo(function OverviewPane({
  plans,
  loading,
  error,
  onRetry,
  selectedId,
  onSelect,
  onIgnite,
  onRedeem,
  recipient,
  onRecipient,
  trial,
  trialPending,
  onTrial,
  refCode,
  onRefCode,
  showRef,
  onInvite,
  tier,
  tierOptions,
  onTier,
  isMember,
  preview,
}: {
  plans: Plan[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onIgnite: () => void;
  onRedeem: () => void;
  recipient: Recipient;
  onRecipient: (next: Recipient) => void;
  trial: boolean;
  trialPending: boolean;
  onTrial: () => void;
  refCode: RefBonus;
  onRefCode: (next: RefBonus) => void;
  showRef: boolean;
  onInvite: () => void;
  tier: TierId;
  tierOptions: TierOption[];
  onTier: (next: TierId) => void;
  isMember: boolean;
  preview: SharedPreview | undefined;
}) {
  const { t } = useTranslation();
  const gift = recipient === 'gift';
  const shared = tier !== 'solo';

  if (error) {
    return (
      <div>
        <p className="text-[14px] text-red-200/90">{t('starpass.loadError')}</p>
        <div className="mt-3">
          <GhostBtn onClick={onRetry}>{t('starpass.retry')}</GhostBtn>
        </div>
      </div>
    );
  }

  return (
    <div>
      {isMember ? (
        <p className="mb-3 rounded-[12px] border border-ink/[0.08] bg-ink/[0.03] px-3.5 py-2.5 text-[12px] text-ink-55">
          {t('starpass.shared.memberBuy')}
        </p>
      ) : (
        <TierSwitch value={tier} options={tierOptions} onChange={onTier} />
      )}
      {!shared && <RecipientSwitch value={recipient} onChange={onRecipient} />}

      {/* duration segmented */}
      <div className="flex gap-1.5 rounded-[14px] border border-ink/[0.10] bg-ink/[0.04] p-1.5">
        {(loading ? [] : plans).map((p) => {
          const on = p.id === selectedId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className="flex-1 cursor-pointer rounded-[10px] px-2 py-2.5 text-center font-mono text-[12px] transition-all duration-200"
              style={{
                color: on ? 'rgb(var(--ink))' : 'rgb(var(--ink) / 0.5)',
                background: on
                  ? 'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 28%, transparent), transparent), rgb(var(--ink) / 0.06)'
                  : undefined,
                boxShadow: on
                  ? '0 0 18px -4px var(--color-accent-glow), inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 45%, transparent)'
                  : undefined,
              }}
            >
              {t(`starpass.plan.${monthsKey(p.months)}`)}
              {/* unified across tabs: every plan shows its price; the accent −%
                  rides alongside only where there's a saving (no mixed slots) */}
              <span className="mt-1 flex items-center justify-center gap-1.5 text-[9.5px]">
                <span className="text-ink-45">{p.price_rub} ₽</span>
                {p.savings_pct > 0 && (
                  <span className="font-semibold text-accent">−{p.savings_pct}%</span>
                )}
              </span>
            </button>
          );
        })}
        {loading && (
          <div className="flex-1 py-2.5 text-center font-mono text-[12px] text-ink-40">
            {t('starpass.loading')}
          </div>
        )}
      </div>

      {shared && preview && preview.carry_days > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-[12px] border border-ink/[0.08] bg-ink/[0.03] px-3.5 py-2.5">
          <RefreshCw size={15} className="shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium text-ink-85">
              {t('starpass.shared.carryTitle')}
            </div>
            <div className="text-[11.5px] text-ink-40">
              {t('starpass.shared.carryEnd', { date: passDate(preview.ends_at) })}
            </div>
          </div>
          <span className="font-mono text-[15px] font-semibold text-accent">
            {t('starpass.shared.carryDays', { count: preview.carry_days })}
          </span>
        </div>
      )}

      <PerkGrid />

      <div className="mt-[18px] flex flex-wrap items-center gap-3">
        <PrimaryBtn onClick={onIgnite} disabled={!selectedId}>
          {gift ? <Gift size={16} /> : null}
          {gift ? t('starpass.gift.ignite') : t('starpass.ignite')}
          <ArrowRight size={16} />
        </PrimaryBtn>
        {trial && !gift && !shared && (
          <GhostBtn onClick={onTrial}>
            {trialPending
              ? t('starpass.trial.starting')
              : t('starpass.trial.cta', { count: TRIAL_DAYS })}
          </GhostBtn>
        )}
        <LinkBtn onClick={onRedeem}>{t('starpass.haveCode')}</LinkBtn>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
        {showRef && !gift && !shared ? <RefField value={refCode} onChange={onRefCode} /> : <span />}
        <LinkBtn onClick={onInvite}>{t('starpass.invite.link')}</LinkBtn>
      </div>
    </div>
  );
});
