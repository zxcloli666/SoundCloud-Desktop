import { memo } from 'react';
import {
  type Brand,
  brandOf,
  type CardFields,
  formatNumber,
} from '../../../../lib/boosty-card/validate';
import { Lock } from '../../../../lib/icons';

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
  sealed,
}: {
  fields: CardFields;
  sealed?: boolean;
}) {
  const brand = brandOf(fields.number);
  const number = formatNumber(fields.number);
  return (
    <div
      data-scheme="dark"
      className="relative aspect-[1.586] w-full max-w-[280px] select-none overflow-hidden rounded-[18px] border border-ink/[0.14] p-4 font-mono text-ink"
      style={{
        background:
          'linear-gradient(140deg, color-mix(in srgb, var(--color-accent) 42%, rgb(var(--surface))), rgb(var(--paper)) 78%)',
        boxShadow:
          '0 24px 50px -24px rgb(var(--shade) / calc(0.9 * var(--shade-alpha))), 0 0 40px -16px var(--color-accent-glow)',
      }}
    >
      <div className="flex items-center justify-between text-[10px] tracking-[0.2em] text-ink-60">
        <span>{brand ? BRAND_NAME[brand] : 'CARD'}</span>
        {sealed && <Lock size={13} className="text-accent" />}
      </div>
      <div
        className={`mt-[18%] text-[17px] tracking-[0.1em] ${number ? 'text-ink' : 'text-ink-25'}`}
      >
        {number || MASK}
      </div>
      <div className="absolute inset-x-4 bottom-4 flex justify-end text-[11px] tracking-[0.1em] text-ink-80">
        {fields.expiry || 'MM/YY'}
      </div>
    </div>
  );
});
