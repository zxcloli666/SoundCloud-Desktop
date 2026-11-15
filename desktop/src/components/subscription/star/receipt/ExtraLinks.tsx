import { useMutation } from '@tanstack/react-query';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, KeyRound, Users, X } from '../../../../lib/icons';
import { payApi, payErrorCode } from '../../../../lib/pay-client';
import { usePremium } from '../../../../lib/premium-cache';
import { useFlowApi, useOffer } from '../flow/derive';
import { isGift, useFlow } from '../flow/store';
import { Btn } from '../ui/Btn';

export const ExtraLinks = memo(function ExtraLinks() {
  const { t } = useTranslation();
  const api = useFlowApi();
  const premium = usePremium();
  const plain = useFlow((s) => !isGift(s) && s.tier === 'solo');
  const offer = useOffer();
  return (
    <div
      data-ui="star-extras"
      className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1"
    >
      <Btn size="sm" tone="quiet" act="redeem" onClick={() => api.setStep('redeem')}>
        <KeyRound size={13} />
        {t('starpass.haveCode')}
      </Btn>
      <Btn size="sm" tone="quiet" act="invite" onClick={() => api.setStep('invite')}>
        <Users size={13} />
        {t('starpass.invite.link')}
      </Btn>
      {!premium && plain && !offer && <RefCode />}
    </div>
  );
});

const REF_ERRORS: Record<string, string> = {
  ref_unknown: 'starpass.ref.unknown',
  ref_own: 'starpass.ref.own',
  ref_not_first: 'starpass.ref.notFirst',
};

const RefCode = memo(function RefCode() {
  const { t } = useTranslation();
  const value = useFlow((s) => s.refBonus);
  const api = useFlowApi();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const check = useMutation({
    mutationFn: (code: string) => payApi.checkRef(code),
    onSuccess: (r, code) => api.setRefBonus({ code, days: r.bonus_days }),
  });

  if (value) {
    return (
      <span className="star-in inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-accent/12 pl-2.5 pr-1 text-[12px] font-semibold text-ink-90">
        <Check size={13} className="text-accent" />
        {t('starpass.ref.applied', { days: value.days })}
        <button
          type="button"
          aria-label={t('starpass.bind.remove')}
          onClick={() => api.setRefBonus(null)}
          className="grid size-6 cursor-pointer place-items-center rounded-full text-ink-45 hover:text-ink"
        >
          <X size={12} />
        </button>
      </span>
    );
  }
  if (!open) {
    return (
      <Btn size="sm" tone="quiet" onClick={() => setOpen(true)}>
        {t('starpass.ref.have')}
      </Btn>
    );
  }
  const code = draft.trim();
  const error = check.isError
    ? (REF_ERRORS[payErrorCode(check.error) ?? ''] ?? 'starpass.ref.failed')
    : null;
  return (
    <form
      className="star-in flex w-full flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (code) check.mutate(code);
      }}
    >
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value.toUpperCase());
            check.reset();
          }}
          placeholder={t('starpass.ref.placeholder')}
          maxLength={16}
          className={`h-9 min-w-0 flex-1 rounded-[10px] border bg-ink/[0.04] px-3 text-[13px] font-semibold tracking-[0.08em] text-ink outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-35 ${error ? 'border-bad/60' : 'border-ink/[0.12] focus:border-accent'}`}
        />
        <Btn size="sm" submit disabled={!code || check.isPending}>
          {t('starpass.ref.apply')}
        </Btn>
      </div>
      {error && <span className="text-[12px] text-bad">{t(error)}</span>}
    </form>
  );
});
