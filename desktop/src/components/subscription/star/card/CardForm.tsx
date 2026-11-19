import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type CardFields,
  type FieldName,
  formatCvv,
  formatExpiry,
  formatNumber,
  invalidFields,
} from '../../../../lib/card-link/validate';
import { Lock } from '../../../../lib/icons';
import { Btn } from '../ui/Btn';
import { CardFace } from './CardFace';
import { useFieldHops } from './hops';

const INPUT =
  'h-11 w-full rounded-[12px] border bg-ink/[0.04] px-3.5 font-mono text-[14px] tracking-[0.06em] text-ink outline-none transition-colors placeholder:text-ink-25 focus:bg-ink/[0.06]';

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
        className={`mb-1.5 block text-[12px] font-semibold ${bad ? 'text-bad' : 'text-ink-45'}`}
      >
        {t(`starpass.card.field.${name}`)}
      </span>
      {children}
    </label>
  );
}

export const CardForm = memo(function CardForm({
  amount,
  initial,
  invalid,
  onSubmit,
  onCancel,
}: {
  amount: string | null;
  initial: CardFields;
  invalid: FieldName[];
  onSubmit: (card: CardFields) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<CardFields>(initial);
  const { slot, hop } = useFieldHops();
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
  };
  const typing = { autoComplete: 'off', autoCorrect: 'off', spellCheck: false } as const;
  const hidden = { 'data-lpignore': 'true', 'data-1p-ignore': 'true' } as const;

  return (
    <form
      className="flex flex-col gap-6 sm:flex-row sm:items-start"
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
              ref={slot(0)}
              onKeyDown={hop(0)}
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
            ref={slot(1)}
            onKeyDown={hop(1)}
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
            ref={slot(2)}
            onKeyDown={hop(2)}
            className={`${INPUT} ${border('cvv')}`}
            inputMode="numeric"
            placeholder="•••"
            value={fields.cvv}
            onChange={(e) => set('cvv', formatCvv(e.target.value, fields.number))}
          />
        </Field>
        <div className="col-span-2 mt-1 flex flex-wrap items-center gap-2">
          <Btn tone="primary" size="lg" submit act="card-submit">
            {amount ? `${t('starpass.bind.linkPay')} · ${amount}` : t('starpass.bind.link')}
          </Btn>
          <Btn tone="quiet" onClick={onCancel}>
            {t('starpass.card.cancel')}
          </Btn>
        </div>
        <span className="col-span-2 flex items-center gap-1.5 text-[11.5px] text-ink-45">
          <Lock size={12} className="shrink-0" />
          {t('starpass.card.secure')}
        </span>
      </div>
    </form>
  );
});
