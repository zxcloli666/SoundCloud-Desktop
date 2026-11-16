import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBinds, useRemoveBind } from '../../../../lib/binds';
import { Info } from '../../../../lib/icons';
import { chargeAmount, passDate, priceIn } from '../../../../lib/star-format';
import { useBindState, useFlowApi, useSel } from '../flow/derive';
import {
  amountOf,
  canOnceOf,
  currencyIn,
  offerOf,
  periodDaysOf,
  pickedOf,
  renewAvailableOf,
  routeOf,
} from '../flow/select';
import { BindItem } from '../manage/BindItem';
import { Switch } from '../ui/Switch';

const DAY_SECS = 86_400;

export const RenewRow = memo(function RenewRow() {
  const { t } = useTranslation();
  const available = useSel(renewAvailableOf);
  const on = useSel((s, e) => routeOf(s, e)?.recurring === true);
  const oneOff = useSel((s, e) => {
    const route = routeOf(s, e);
    return route?.viaBind === true && !route.recurring;
  });
  const ownLink = useSel((s, e) => !!pickedOf(s, e)?.bind && canOnceOf(s, e));
  const periodDays = useSel(periodDaysOf);
  const charge = useSel(amountOf);
  const later = useSel((s, e) => {
    const offer = offerOf(s, e);
    if (!offer?.requires_bind || !offer.renews_at_price) return null;
    const { amount, currency } = priceIn(offer.renews_at_price, currencyIn(s, e));
    return chargeAmount(amount, currency);
  });
  const api = useFlowApi();
  const nextAt = Math.floor(Date.now() / 1000) + periodDays * DAY_SECS;
  const shown = available || later !== null;
  return (
    <div data-ui="star-renew">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1" style={{ opacity: shown ? 1 : 0.5 }}>
          <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-90">
            {t('starpass.renew.title')}
            {available && (
              <span title={t('starpass.renew.refund')} className="text-ink-35">
                <Info size={13} />
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[12px] leading-snug tabular-nums text-ink-45">
            {later !== null
              ? t('starOffer.renews', { price: later, date: passDate(nextAt) })
              : !available
                ? t('starpass.renew.unavailable')
                : on
                  ? t('starpass.renew.next', { date: passDate(nextAt), charge })
                  : oneOff
                    ? t('starpass.renew.offOnce')
                    : ownLink
                      ? t('starpass.renew.onceNote')
                      : t('starpass.renew.every', { count: periodDays })}
          </div>
        </div>
        <Switch
          on={on}
          disabled={!available}
          onChange={api.setRenew}
          label={t('starpass.renew.title')}
        />
      </div>
      <BindNote oneOff={oneOff} charge={charge} />
    </div>
  );
});

const BindNote = memo(function BindNote({ oneOff, charge }: { oneOff: boolean; charge: string }) {
  const { t } = useTranslation();
  const { viaBind, state } = useBindState();
  const picked = useSel(pickedOf);
  const flows = useBinds(viaBind).data;
  const removeBind = useRemoveBind();
  if (!viaBind || !picked?.bind) return null;
  const linked = state === 'linked' || state === 'rebind';
  const view = flows?.methods.find((b) => b.method === picked.id);
  return (
    <>
      {oneOff && (
        <p className="px-4 pb-3 text-[11.5px] leading-relaxed text-ink-45 sm:px-5">
          {t(oneOffKey(picked.bind.flow === 'qr', linked), { charge })}
        </p>
      )}
      {linked && view && (
        <div className="border-t border-ink/[0.07]">
          <BindItem
            bind={{ ...view, can_link: false }}
            used={!oneOff}
            removing={removeBind.isPending}
            onRemove={() => removeBind.mutate(picked.id)}
          />
        </div>
      )}
    </>
  );
});

function oneOffKey(qr: boolean, linked: boolean): string {
  if (linked) return qr ? 'starpass.bind.oneOffLinkedQr' : 'starpass.bind.oneOffLinkedCard';
  return qr ? 'starpass.bind.oneOffQr' : 'starpass.bind.oneOffCard';
}
