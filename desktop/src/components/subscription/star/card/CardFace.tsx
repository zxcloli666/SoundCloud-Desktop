import { memo } from 'react';
import {
  type Brand,
  brandOf,
  type CardFields,
  formatNumber,
} from '../../../../lib/card-link/validate';
import { Lock } from '../../../../lib/icons';
import { AccentSpinner } from '../AccentSpinner';

const BRAND_NAME: Record<Brand, string> = {
  mir: 'MIR',
  visa: 'VISA',
  mc: 'MASTERCARD',
  amex: 'AMEX',
  unionpay: 'UNIONPAY',
};

const MASK = '•••• •••• •••• ••••';

export const CardFace = memo(function CardFace({
  fields,
  sealed = false,
  busy = false,
}: {
  fields: CardFields;
  sealed?: boolean;
  busy?: boolean;
}) {
  const brand = brandOf(fields.number);
  const number = formatNumber(fields.number);
  return (
    <div
      data-scheme="dark"
      data-ui="star-card-face"
      className="relative aspect-[1.586] w-[260px] max-w-full shrink-0 select-none overflow-hidden rounded-[18px] p-4 text-ink"
      style={{
        background:
          'linear-gradient(140deg, color-mix(in srgb, var(--color-accent) 70%, #1a1a20), #121216 72%)',
        boxShadow:
          '0 24px 50px -24px rgb(var(--shade) / calc(0.9 * var(--shade-alpha))), inset 0 0 0 1px rgb(var(--ink) / 0.12)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="h-6 w-8 rounded-[6px] bg-ink/25" />
        <span className="text-[11px] font-bold tracking-[0.12em] text-ink-80">
          {brand ? BRAND_NAME[brand] : ''}
        </span>
      </div>
      <div
        className={`mt-[17%] whitespace-nowrap font-mono text-[16.5px] tracking-[0.08em] ${number ? 'text-ink' : 'text-ink-40'}`}
      >
        {number || MASK}
      </div>
      <div className="absolute inset-x-4 bottom-4 flex items-center justify-between font-mono text-[11.5px] text-ink-80">
        <span>{sealed && <Lock size={14} className="text-ink" />}</span>
        <span>{fields.expiry || 'MM/YY'}</span>
      </div>
      {busy && (
        <div className="absolute inset-0 grid place-items-center bg-shade-30">
          <AccentSpinner />
        </div>
      )}
    </div>
  );
});
