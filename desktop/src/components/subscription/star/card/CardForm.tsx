import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type CardFields,
  EMPTY_CARD,
  type FieldName,
  formatCvv,
  formatExpiry,
  formatNumber,
  invalidFields,
} from '../../../../lib/boosty-card/validate';
import { Lock } from '../../../../lib/icons';
import { PrimaryBtn } from '../StarConsole';
import { CardFace } from './CardFace';

const INPUT =
  'w-full rounded-[11px] border bg-ink/[0.04] px-3.5 py-3 font-mono text-[14px] tracking-[0.08em] text-ink outline-none transition-colors placeholder:text-ink-25 focus:bg-ink/[0.06]';

function Field({
  name,
  bad,
  children,
}: {
  name: FieldName;
  bad: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <label className="block">
      <span
        className={`mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] ${bad ? 'text-bad' : 'text-ink-40'}`}
      >
        {t(`starpass.card.field.${name}`)}
      </span>
      {children}
    </label>
  );
}

export const CardForm = memo(function CardForm({
  amount,
  invalid,
  onSubmit,
}: {
  amount: string | null;
  invalid: FieldName[];
  onSubmit: (card: CardFields) => void;
}) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<CardFields>(EMPTY_CARD);
  const [flagged, setFlagged] = useState<FieldName[]>(invalid);
  const set = (name: FieldName, value: string) => {
    setFields((now) => ({ ...now, [name]: value }));
    setFlagged((now) => now.filter((flag) => flag !== name));
  };
  const border = (name: FieldName) =>
    flagged.includes(name) ? 'border-bad/60' : 'border-ink/[0.12] focus:border-accent';
  const send = () => {
    const wrong = invalidFields(fields);
    setFlagged(wrong);
    if (wrong.length > 0) return;
    onSubmit(fields);
    setFields(EMPTY_CARD);
  };
  const typing = { autoComplete: 'off', autoCorrect: 'off', spellCheck: false } as const;
  const hidden = { 'data-lpignore': 'true', 'data-1p-ignore': 'true' } as const;

  return (
    <form
      className="flex flex-col gap-5 sm:flex-row sm:items-start"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div className="flex shrink-0 justify-center sm:block">
        <CardFace fields={fields} />
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
        <div className="col-span-2">
          <Field name="number" bad={flagged.includes('number')}>
            <input
              {...typing}
              {...hidden}
              className={`${INPUT} ${border('number')}`}
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              value={fields.number}
              onChange={(e) => set('number', formatNumber(e.target.value))}
            />
          </Field>
        </div>
        <Field name="expiry" bad={flagged.includes('expiry')}>
          <input
            {...typing}
            {...hidden}
            className={`${INPUT} ${border('expiry')}`}
            inputMode="numeric"
            placeholder="MM/YY"
            value={fields.expiry}
            onChange={(e) => set('expiry', formatExpiry(e.target.value, fields.expiry))}
          />
        </Field>
        <Field name="cvv" bad={flagged.includes('cvv')}>
          <input
            {...typing}
            {...hidden}
            type="password"
            className={`${INPUT} ${border('cvv')}`}
            inputMode="numeric"
            placeholder="•••"
            value={fields.cvv}
            onChange={(e) => set('cvv', formatCvv(e.target.value, fields.number))}
          />
        </Field>
        <div className="col-span-2 mt-1 flex flex-wrap items-center gap-3">
          <PrimaryBtn onClick={send}>
            {amount ? `${t('starpass.bind.linkPay')} · ${amount}` : t('starpass.bind.link')}
          </PrimaryBtn>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.06em] text-ink-40">
            <Lock size={12} />
            {t('starpass.card.secure')}
          </span>
        </div>
      </div>
    </form>
  );
});
