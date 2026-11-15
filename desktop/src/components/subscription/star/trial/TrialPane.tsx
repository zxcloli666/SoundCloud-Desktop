import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlans } from '../../../../lib/binds';
import type { BindFlow, MethodId } from '../../../../lib/pay-client';
import { AccentSpinner } from '../AccentSpinner';
import { useFlowApi } from '../flow/derive';
import { Btn } from '../ui/Btn';
import { MethodChoice } from '../ui/MethodChoice';
import { Title } from '../ui/Panel';
import { useTrialStep } from './useTrialStep';

export const TrialPane = memo(function TrialPane() {
  const { t } = useTranslation();
  const { offer, loading, method, amount, blocked } = useTrialStep();
  const api = useFlowApi();
  const flowOf = useTrialFlow();
  if (!offer && loading) return <AccentSpinner />;
  if (blocked || !offer || !method) {
    return (
      <div data-ui="star-trial" data-state="blocked">
        <Title sub={t(`starpass.trial.refused.${blocked ?? 'no_methods'}`)}>
          {t('starpass.trial.title')}
        </Title>
        <Btn tone="primary" onClick={() => api.setStep('overview')}>
          {t('starMoments.getStar')}
        </Btn>
      </div>
    );
  }
  return (
    <div data-ui="star-trial">
      <Title sub={t('starpass.trial.terms', { count: offer.days, amount })}>
        {t('starpass.trial.cta', { count: offer.days })}
      </Title>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {offer.methods.map((id) => (
          <MethodChoice key={id} id={id} on={id === method} onPick={api.pickTrial} />
        ))}
      </div>
      <div className="mt-5">
        <Btn
          tone="primary"
          size="lg"
          act="trial-link"
          onClick={() => api.startLink(method, flowOf(method), true)}
        >
          {t('starpass.bind.link')}
        </Btn>
      </div>
    </div>
  );
});

function useTrialFlow() {
  const methods = usePlans().data?.methods;
  return (id: MethodId): BindFlow => methods?.find((m) => m.id === id)?.bind?.flow ?? 'card_form';
}
