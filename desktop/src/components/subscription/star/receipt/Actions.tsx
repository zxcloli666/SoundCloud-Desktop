import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from '../../../../lib/icons';
import { payErrorText } from '../flow/actions';
import { purchaseNow, useBindState, useChoosing, useEnv, useFlowApi, useSel } from '../flow/derive';
import { canOnceOf, pickedOf, planIdOf } from '../flow/select';
import { isGift, useFlow, useFlowStore } from '../flow/store';
import { useTrialDays, useTrialStep } from '../trial/useTrialStep';
import { Btn } from '../ui/Btn';
import { Progress } from './Progress';

const PROGRESS = new Set(['pay', 'card', 'sbp', 'trial', 'success']);

export const Actions = memo(function Actions() {
  const choosing = useChoosing();
  const step = useFlow((s) => (PROGRESS.has(s.step) ? s.step : null));
  if (choosing) {
    return (
      <>
        <PayButton />
        <PayError />
        <TrialButton />
      </>
    );
  }
  if (step === 'trial') return <TrialAction />;
  return step ? <Progress /> : <GetStar />;
});

const TrialAction = memo(function TrialAction() {
  const { offer, method, blocked } = useTrialStep();
  return blocked || !offer?.available || !method ? <GetStar /> : <Progress />;
});

function usePayNext() {
  const store = useFlowStore();
  const env = useEnv();
  const api = useFlowApi();
  const { viaBind, state } = useBindState();
  return useCallback(() => {
    const s = store.getState();
    const purchase = purchaseNow(s, env);
    const picked = pickedOf(s, env);
    if (!purchase || !picked) return;
    if (viaBind && state !== 'linked' && picked.bind) {
      api.openLink(picked.bind.flow);
      return;
    }
    void api.placeOrder(purchase);
  }, [store, env, api, viaBind, state]);
}

const PayButton = memo(function PayButton() {
  const { t } = useTranslation();
  const picked = useSel((s, e) => pickedOf(s, e) !== null);
  const planned = useSel((s, e) => planIdOf(s, e) !== null);
  const gift = useFlow(isGift);
  const paying = useFlow((s) => s.paying);
  const { viaBind, state } = useBindState();
  const next = usePayNext();
  const needsLink = viaBind && state !== 'linked';
  return (
    <Btn
      tone="primary"
      size="lg"
      wide
      act="pay"
      disabled={!picked || !planned || paying || (viaBind && state === null)}
      onClick={next}
    >
      {paying ? (
        t('starpass.creating')
      ) : (
        <>
          {t(
            !picked
              ? 'starpass.howToPay'
              : needsLink
                ? 'starpass.bind.linkPay'
                : gift
                  ? 'starpass.gift.ignite'
                  : 'starpass.continue',
          )}
          <ArrowRight size={16} />
        </>
      )}
    </Btn>
  );
});

const PayError = memo(function PayError() {
  const { t } = useTranslation();
  const error = useFlow((s) => s.payError);
  const once = useSel((s, e) => canOnceOf(s, e));
  const { viaBind } = useBindState();
  const store = useFlowStore();
  const env = useEnv();
  const api = useFlowApi();
  if (!error) return null;
  const payOnce = () => {
    const purchase = purchaseNow(store.getState(), env);
    if (purchase) api.payOnce(purchase);
  };
  return (
    <>
      <span data-ui="star-pay-error" className="text-[12.5px] text-bad">
        {payErrorText(error)}
      </span>
      {viaBind && once && (
        <Btn tone="quiet" size="sm" onClick={payOnce}>
          {t('starpass.bind.payOnce')}
        </Btn>
      )}
    </>
  );
});

const TrialButton = memo(function TrialButton() {
  const { t } = useTranslation();
  const days = useTrialDays();
  const api = useFlowApi();
  if (days === null) return null;
  return (
    <Btn wide act="trial" onClick={api.openTrial}>
      {t('starpass.trial.cta', { count: days })}
    </Btn>
  );
});

const GetStar = memo(function GetStar() {
  const { t } = useTranslation();
  const api = useFlowApi();
  return (
    <Btn tone="primary" size="lg" wide onClick={() => api.setStep('overview')}>
      {t('starMoments.getStar')}
      <ArrowRight size={16} />
    </Btn>
  );
});
