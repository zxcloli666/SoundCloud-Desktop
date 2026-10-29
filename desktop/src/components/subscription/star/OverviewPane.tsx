import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Gift } from '../../../lib/icons';
import type { Plan } from '../../../lib/pay-client';
import { TRIAL_DAYS } from '../../../lib/star-offer';
import { monthsKey, PERKS, type Recipient } from './meta';
import { RecipientSwitch } from './RecipientSwitch';
import { type RefBonus, RefField } from './RefField';
import { GhostBtn, LinkBtn, PrimaryBtn } from './StarConsole';

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
}) {
  const { t } = useTranslation();
  const gift = recipient === 'gift';

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
      <RecipientSwitch value={recipient} onChange={onRecipient} />

      {/* duration segmented */}
      <div className="flex gap-1.5 rounded-[14px] border border-white/[0.10] bg-white/[0.04] p-1.5">
        {(loading ? [] : plans).map((p) => {
          const on = p.id === selectedId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className="flex-1 cursor-pointer rounded-[10px] px-2 py-2.5 text-center font-mono text-[12px] transition-all duration-200"
              style={{
                color: on ? '#fff' : 'rgba(255,255,255,0.5)',
                background: on
                  ? 'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 28%, transparent), transparent), rgba(255,255,255,0.06)'
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
                <span className="text-white/45">{p.price_rub} ₽</span>
                {p.savings_pct > 0 && (
                  <span className="font-semibold text-accent">−{p.savings_pct}%</span>
                )}
              </span>
            </button>
          );
        })}
        {loading && (
          <div className="flex-1 py-2.5 text-center font-mono text-[12px] text-white/40">
            {t('starpass.loading')}
          </div>
        )}
      </div>

      {/* perks */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PERKS.map(({ key, Icon }) => (
          <div
            key={key}
            className="flex items-center gap-2.5 rounded-[11px] border border-white/[0.08] bg-white/[0.025] px-2.5 py-2"
          >
            <span
              className="grid size-[28px] shrink-0 place-items-center rounded-[8px]"
              style={{
                background: 'color-mix(in srgb, var(--color-accent) 13%, transparent)',
                boxShadow:
                  'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 22%, transparent)',
              }}
            >
              <Icon size={14} className="text-accent" />
            </span>
            <span className="text-[12px] font-medium leading-tight text-white/85">
              {t(`starpass.perk.${key}.title`)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-[18px] flex flex-wrap items-center gap-3">
        <PrimaryBtn onClick={onIgnite} disabled={!selectedId}>
          {gift ? <Gift size={16} /> : null}
          {gift ? t('starpass.gift.ignite') : t('starpass.ignite')}
          <ArrowRight size={16} />
        </PrimaryBtn>
        {trial && !gift && (
          <GhostBtn onClick={onTrial}>
            {trialPending
              ? t('starpass.trial.starting')
              : t('starpass.trial.cta', { count: TRIAL_DAYS })}
          </GhostBtn>
        )}
        <LinkBtn onClick={onRedeem}>{t('starpass.haveCode')}</LinkBtn>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
        {showRef && !gift ? <RefField value={refCode} onChange={onRefCode} /> : <span />}
        <LinkBtn onClick={onInvite}>{t('starpass.invite.link')}</LinkBtn>
      </div>
    </div>
  );
});
