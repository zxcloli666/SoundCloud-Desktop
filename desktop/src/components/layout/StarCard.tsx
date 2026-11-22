import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Star } from '../../lib/icons';
import { money, monthsOf } from '../../lib/offer-format';
import { usePersonalOffer } from '../../lib/personal-offer';
import { useOpenStar } from '../../lib/star-offer';
import { SOON_DAYS, type StarStatus, useStarLine, useStarStatus } from '../../lib/star-status';
import { OfferBar, OfferTimer } from '../offer/OfferCopy';

type Tone = 'calm' | 'warn' | 'bad';

const LINE: Record<Tone, string> = {
  calm: 'text-[10.5px] font-medium text-ink-55',
  warn: 'text-[11px] font-bold text-amber-400',
  bad: 'text-[11px] font-bold text-bad',
};

const FILL: Record<Tone, string> = {
  calm: 'bg-amber-400',
  warn: 'bg-amber-400',
  bad: 'bg-bad',
};

const EDGE: Record<Tone, string> = {
  calm: 'var(--shell-line-hi)',
  warn: 'color-mix(in srgb, var(--color-amber-400) 45%, transparent)',
  bad: 'rgb(var(--bad) / 0.5)',
};

function toneOf(status: StarStatus | null): Tone {
  if (status?.kind === 'renews') return status.soon ? 'warn' : 'calm';
  if (status?.kind === 'relink' || status?.kind === 'confirm') return 'warn';
  if (status?.kind !== 'ends' || status.level === 'calm') return 'calm';
  return status.level === 'urgent' ? 'bad' : 'warn';
}

export const StarCard = memo(function StarCard({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openStar = useOpenStar();
  const status = useStarStatus();
  const line = useStarLine(status);
  const tone = toneOf(status);
  const ending = status?.kind === 'ends' && status.level !== 'calm' ? status : null;
  const charging = status?.kind === 'renews' && status.soon ? status : null;
  const offer = ending?.canExtend ? (ending.trial ? 'buy' : 'extend') : null;
  const personal = usePersonalOffer();
  const deal = personal?.ends_at != null && !ending && !charging ? personal : null;
  const open = () => {
    if (deal) openStar('buy', undefined, deal.id);
    else if (offer) openStar(offer);
    else navigate('/star');
  };

  if (collapsed) {
    return (
      <button
        type="button"
        data-ui="star-card"
        data-tone={tone}
        onClick={open}
        title={
          deal
            ? `${t('star.title')} · ${t(`starOffer.short.${monthsOf(deal)}`, { price: money(deal, deal.price) })}`
            : line
              ? `${t('star.title')} · ${line}`
              : t('star.title')
        }
        className="relative flex items-center justify-center w-full py-2.5 rounded-lg cursor-pointer transition-colors duration-150 hover:bg-ink/[0.08] group"
        style={{ background: 'var(--shell-fill)', border: `1px solid ${EDGE[tone]}` }}
      >
        <span className="text-amber-400">
          <Star size={16} fill="currentColor" />
        </span>
        {deal && <span className="absolute right-1 top-1 size-2 rounded-full bg-accent" />}
        {(ending || charging) && (
          <span
            className={`absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-black tabular-nums text-paper ${FILL[tone]}`}
          >
            {ending ? ending.days : <RefreshCw size={9} strokeWidth={3} />}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-ui="star-card"
      data-tone={tone}
      onClick={open}
      className="relative flex w-full px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-150 hover:bg-ink/[0.08] overflow-hidden group"
      style={{ background: 'var(--shell-fill)', border: `1px solid ${EDGE[tone]}` }}
    >
      <div className="relative flex w-full flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-amber-400 shrink-0">
            <Star size={16} fill="currentColor" />
          </span>
          <div className="flex min-w-0 flex-col items-start">
            <span className="text-[11px] font-semibold text-ink-90 tracking-wide">
              {t('star.title')}
            </span>
            <span className={`whitespace-nowrap tabular-nums ${LINE[tone]}`}>
              {deal
                ? t(`starOffer.short.${monthsOf(deal)}`, { price: money(deal, deal.price) })
                : (line ?? t('star.getIt'))}
            </span>
            {deal && (
              <span className="whitespace-nowrap text-[9.5px] font-medium text-ink-50">
                <OfferTimer endsAt={deal.ends_at} />
              </span>
            )}
            {charging && (
              <span className="whitespace-nowrap text-[9.5px] font-medium tabular-nums text-ink-50">
                {charging.trialUntil
                  ? `↻ ${t('star.in', { count: charging.days })} · ${charging.charge}`
                  : t('star.in', { count: charging.days })}
              </span>
            )}
          </div>
        </div>
        {deal && <OfferBar offer={deal} />}
        {ending && (
          <span className="h-1 w-full overflow-hidden rounded-full bg-ink/[0.08]">
            <span
              className={`block h-full rounded-full ${FILL[tone]}`}
              style={{ width: `${(ending.days / SOON_DAYS) * 100}%` }}
            />
          </span>
        )}
        {offer && ending?.level === 'urgent' && (
          <span
            className="flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-[11px] font-semibold text-accent-contrast"
            style={{ background: 'var(--color-accent)' }}
          >
            <Star size={10} fill="currentColor" />
            {t(offer === 'buy' ? 'starMoments.getStar' : 'starMoments.extend')}
          </span>
        )}
      </div>
    </button>
  );
});
