import { useQuery } from '@tanstack/react-query';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift } from '../../../lib/icons';
import { payApi } from '../../../lib/pay-client';
import { GiftTicket } from './GiftTicket';
import { PrimaryBtn, Ttl } from './StarConsole';

export const GIFTS_KEY = ['pay', 'gifts'] as const;

/** Every gift code this account bought, newest first, plus a way to buy another. */
export const GiftsPane = memo(function GiftsPane({ onGiftMore }: { onGiftMore: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: GIFTS_KEY, queryFn: payApi.gifts });
  const gifts = data?.gifts ?? [];

  return (
    <div>
      <Ttl>{t('starpass.gift.mine')}</Ttl>
      {isLoading ? (
        <div className="font-mono text-[12px] text-white/40">{t('starpass.loading')}</div>
      ) : gifts.length === 0 ? (
        <p className="text-[12.5px] text-white/50">{t('starpass.gift.none')}</p>
      ) : (
        <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto">
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
      <div className="mt-4">
        <PrimaryBtn onClick={onGiftMore}>
          <Gift size={15} />
          {t('starpass.gift.another')}
        </PrimaryBtn>
      </div>
    </div>
  );
});
