import { useQuery } from '@tanstack/react-query';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift } from '../../../../lib/icons';
import { payApi } from '../../../../lib/pay-client';
import { useFlowApi } from '../flow/derive';
import { GIFTS_KEY } from '../flow/keys';
import { Btn } from '../ui/Btn';
import { Title } from '../ui/Panel';
import { GiftTicket } from './GiftTicket';

export const GiftsStep = memo(function GiftsStep() {
  const { t } = useTranslation();
  const api = useFlowApi();
  const { data, isLoading } = useQuery({ queryKey: GIFTS_KEY, queryFn: payApi.gifts });
  const gifts = data?.gifts ?? [];
  return (
    <div data-ui="star-gifts">
      <Title sub={gifts.length ? t('starpass.gift.howTo') : undefined}>
        {t('starpass.gift.mine')}
      </Title>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[62px] animate-pulse rounded-[16px] bg-ink/[0.05]" />
          ))}
        </div>
      ) : gifts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[16px] bg-ink/[0.03] px-4 py-7 text-center">
          <Gift size={22} className="text-ink-30" />
          <p className="text-[13px] text-ink-50">{t('starpass.gift.none')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {gifts.map((g) => (
            <GiftTicket
              key={g.order_id}
              code={g.code}
              periodDays={g.period_days}
              redeemed={g.redeemed}
            />
          ))}
        </div>
      )}
      <div className="mt-5">
        <Btn tone="primary" act="gift-more" onClick={api.giftMore}>
          <Gift size={15} />
          {t('starpass.gift.another')}
        </Btn>
      </div>
    </div>
  );
});
