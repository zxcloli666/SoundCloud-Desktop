import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PerkChips } from '../choose/PerkChips';
import { useCurrentOrder, useFlowApi, useSelectedPlan } from '../flow/derive';
import { useFlow } from '../flow/store';
import { Btn } from '../ui/Btn';
import { PaidMark } from '../ui/Orb';
import { Panel } from '../ui/Panel';
import { GiftTicket } from './GiftTicket';

export const Success = memo(function Success() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const api = useFlowApi();
  const shared = useFlow((s) => s.tier !== 'solo');
  const { order } = useCurrentOrder();
  const plan = useSelectedPlan();
  const gift = order?.gift && order.gift_code ? order.gift_code : null;
  return (
    <Panel data-ui="star-success" className="flex flex-col items-center gap-4 py-8 text-center">
      <PaidMark />
      <div className="text-[22px] font-extrabold tracking-tight text-ink">
        {t(gift ? 'starpass.gift.ready' : 'starpass.successTitle')}
      </div>
      {gift ? (
        <div className="w-full max-w-[520px] text-left">
          <GiftTicket code={gift} periodDays={plan?.period_days ?? 30} />
          <p className="mt-2.5 text-center text-[12.5px] text-ink-50">{t('starpass.gift.howTo')}</p>
        </div>
      ) : (
        <>
          <p className="-mt-2 text-[13px] text-ink-55">{t('starpass.successSub')}</p>
          <div className="max-w-[580px]">
            <PerkChips lit center />
          </div>
        </>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Btn tone="primary" act="music" onClick={() => navigate('/home')}>
          {t('starpass.backToMusic')}
        </Btn>
        {gift ? (
          <Btn onClick={() => api.setStep('gifts')}>{t('starpass.gift.mine')}</Btn>
        ) : (
          <Btn onClick={() => api.setStep('manage')}>{t('starpass.managePass')}</Btn>
        )}
        {!gift && shared && (
          <Btn onClick={() => api.setStep('plan')}>{t('starpass.shared.inviteMembers')}</Btn>
        )}
      </div>
    </Panel>
  );
});
