import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MethodId, TrialOffer } from '../../../../lib/pay-client';
import type { TrialBlock } from '../../../../lib/star-trial';
import { tileOf } from '../../methods';
import { AccentSpinner } from '../AccentSpinner';
import { MethodTiles } from '../MethodTiles';
import { PrimaryBtn, Ttl } from '../StarConsole';

export const TrialPane = memo(function TrialPane({
  offer,
  loading,
  method,
  amount,
  blocked,
  onPick,
  onLink,
  onBuy,
}: {
  offer: TrialOffer | null;
  loading: boolean;
  method: MethodId | null;
  amount: string;
  blocked: TrialBlock | null;
  onPick: (method: MethodId) => void;
  onLink: (method: MethodId) => void;
  onBuy: () => void;
}) {
  const { t } = useTranslation();
  if (!offer && loading) return <AccentSpinner />;
  if (blocked || !offer || !method) {
    return (
      <div data-ui="star-trial">
        <Ttl>{t('starpass.trial.title')}</Ttl>
        <p className="text-[13px] leading-relaxed text-ink-80">
          {t(`starpass.trial.refused.${blocked ?? 'no_methods'}`)}
        </p>
        <div className="mt-[18px]">
          <PrimaryBtn onClick={onBuy}>{t('starMoments.getStar')}</PrimaryBtn>
        </div>
      </div>
    );
  }

  const tiles = offer.methods.map(tileOf);
  return (
    <div data-ui="star-trial">
      <Ttl>{t('starpass.trial.title')}</Ttl>
      <MethodTiles tiles={tiles} selected={method} onSelect={onPick} />
      <p className="mt-3.5 text-[12.5px] leading-relaxed text-ink-60">
        {t('starpass.trial.terms', { count: offer.days, amount })}
      </p>
      <div className="mt-[18px]">
        <PrimaryBtn onClick={() => onLink(method)}>{t('starpass.bind.link')}</PrimaryBtn>
      </div>
    </div>
  );
});
