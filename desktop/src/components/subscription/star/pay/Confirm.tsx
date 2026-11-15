import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfirmAction, useChargeConfirm } from '../../../../lib/charge-confirm';
import { ExternalLink, Lock, X } from '../../../../lib/icons';
import { Btn } from '../ui/Btn';
import { Orb } from '../ui/Orb';
import { StageLayout } from './StageLayout';

const BANK_STEPS = ['opening', 'open', 'closed'] as const;

export const Confirm = memo(function Confirm({
  action,
  onChangeMethod,
}: {
  action: ConfirmAction;
  onChangeMethod: () => void;
}) {
  const { t } = useTranslation();
  const { state, reopen } = useChargeConfirm(action);
  const failed = state === 'failed';
  const at = BANK_STEPS.indexOf(state as (typeof BANK_STEPS)[number]);
  return (
    <StageLayout
      data-ui="star-pay-confirm"
      visual={
        <Orb tone={failed ? 'bad' : 'wait'}>{failed ? <X size={24} /> : <Lock size={22} />}</Orb>
      }
      title={t(`starpass.confirm.${state}`)}
      hint={
        !failed && (
          <span className="flex flex-col gap-2">
            {state === 'closed' && <span>{t('starpass.confirm.closedHint')}</span>}
            <span className="flex items-center justify-center gap-1.5 sm:justify-start">
              {BANK_STEPS.map((step, i) => (
                <span
                  key={step}
                  className="h-1.5 w-9 rounded-full transition-colors duration-500"
                  style={{
                    background: i <= at ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.12)',
                    opacity: i === at ? 1 : 0.55,
                  }}
                />
              ))}
            </span>
          </span>
        )
      }
    >
      {(state === 'closed' || failed) && (
        <Btn tone="primary" onClick={() => void reopen()}>
          <ExternalLink size={14} />
          {t('starpass.confirm.reopen')}
        </Btn>
      )}
      <Btn tone="quiet" onClick={onChangeMethod}>
        {t('starpass.changeMethod')}
      </Btn>
    </StageLayout>
  );
});
