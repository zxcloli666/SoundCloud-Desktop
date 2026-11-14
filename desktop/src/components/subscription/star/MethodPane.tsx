import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../lib/icons';
import type { BoostyMethod } from '../../../lib/pay-client';
import type { ActivationOption } from '../providers';
import { LinkedBind } from './LinkedBind';
import { MethodTiles } from './MethodTiles';
import { LinkBtn, PrimaryBtn, Ttl } from './StarConsole';

export interface RenewSwitch {
  available: boolean;
  forced: boolean;
  on: boolean;
  periodDays: number | null;
  otherProvider: boolean;
}

export interface BindRow {
  method: BoostyMethod;
  bound: boolean | null;
  rebind: boolean;
  removing: boolean;
  onRemove: () => void;
}

export const MethodPane = memo(function MethodPane({
  options,
  selected,
  onSelect,
  renew,
  onRenew,
  bind,
  amount,
  pending,
  error,
  onOnce,
  onContinue,
}: {
  options: ActivationOption[];
  selected: ActivationOption | null;
  onSelect: (o: ActivationOption) => void;
  renew: RenewSwitch;
  onRenew: (on: boolean) => void;
  bind: BindRow | null;
  amount: string;
  pending: boolean;
  error: string | null;
  onOnce: (() => void) | null;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <Ttl>{t('starpass.howToPay')}</Ttl>
      <MethodTiles
        tiles={options}
        selected={selected?.kind ?? null}
        onSelect={(kind) => {
          const opt = options.find((o) => o.kind === kind);
          if (opt) onSelect(opt);
        }}
      />

      {selected && <RenewToggle renew={renew} onRenew={onRenew} />}

      {(bind?.bound || bind?.rebind) && (
        <div className="mt-3.5">
          <LinkedBind
            method={bind.method}
            rebind={bind.rebind}
            removing={bind.removing}
            onRemove={bind.onRemove}
          />
        </div>
      )}

      <div className="mt-[18px] flex flex-wrap items-center gap-3">
        <PrimaryBtn onClick={onContinue} disabled={!selected || pending || bind?.bound === null}>
          {pending
            ? t('starpass.creating')
            : `${t(bind?.bound === false ? 'starpass.bind.linkPay' : 'starpass.continue')} · ${amount}`}
        </PrimaryBtn>
        {error && <span className="text-[12.5px] text-red-300/95">{error}</span>}
        {onOnce && <LinkBtn onClick={onOnce}>{t('starpass.bind.payOnce')}</LinkBtn>}
      </div>
    </div>
  );
});

const RenewToggle = memo(function RenewToggle({
  renew,
  onRenew,
}: {
  renew: RenewSwitch;
  onRenew: (on: boolean) => void;
}) {
  const { t } = useTranslation();
  const locked = !renew.available || renew.forced;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={renew.on}
      disabled={locked}
      onClick={() => onRenew(!renew.on)}
      className="mt-3.5 flex w-full cursor-pointer items-center justify-between gap-4 rounded-[12px] border border-ink/[0.10] bg-ink/[0.03] px-3.5 py-2.5 text-left transition-colors hover:bg-ink/[0.05] disabled:cursor-default disabled:hover:bg-ink/[0.03]"
      style={{ opacity: renew.available ? 1 : 0.5 }}
    >
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-ink-85">
          {t('starpass.renew.title')}
        </span>
        <span className="block text-[11px] text-ink-40">
          {renew.available
            ? t(renew.otherProvider ? 'starpass.renew.everyOther' : 'starpass.renew.every', {
                count: renew.periodDays ?? 30,
              })
            : t('starpass.renew.unavailable')}
        </span>
        {renew.available && (
          <span className="block text-[11px] text-ink-40">{t('starpass.renew.refund')}</span>
        )}
        {renew.available && renew.otherProvider && (
          <span className="block text-[11px] text-ink-40">{t('starpass.renew.onceNote')}</span>
        )}
      </span>
      <span
        className="relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors duration-200"
        style={{ background: renew.on ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.16)' }}
      >
        <span
          className="absolute top-[2px] grid size-[16px] place-items-center rounded-full bg-paper transition-transform duration-200"
          style={{ transform: `translateX(${renew.on ? 16 : 2}px)` }}
        >
          {renew.on && <Check size={10} strokeWidth={3.4} className="text-accent" />}
        </span>
      </span>
    </button>
  );
});
