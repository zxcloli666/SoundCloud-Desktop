import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { roleAddress } from '../../../lib/voice/address';
import { NAME_MAX } from '../../../lib/voice/chat/body';
import { useVoiceStore } from '../../../lib/voice/store';
import type { Address, ListenerGender } from '../../../lib/voice/types';
import { AtSign } from '../icons';
import { LineField } from './LineField';

const GENDERS: ListenerGender[] = ['male', 'female'];
const FORMS: Address[] = ['informal', 'formal'];

type Look = 'on' | 'implied' | 'off';

const LOOKS: Record<Look, string> = {
  on: 'border-accent/50 bg-accent/[0.08] text-ink-90',
  implied:
    'border-dashed border-accent/60 bg-transparent text-ink-70 enabled:hover:bg-accent/[0.06]',
  off: 'border-ink/[0.06] bg-ink/[0.02] text-ink-45 enabled:hover:bg-ink/[0.06] enabled:hover:text-ink-70',
};

function Chip({
  look,
  hint,
  onClick,
  children,
}: {
  look: Look;
  hint?: { id: string; text: string };
  onClick: () => void;
  children: ReactNode;
}) {
  const implied = look === 'implied' ? hint : undefined;
  return (
    <button
      type="button"
      aria-pressed={look === 'on'}
      aria-describedby={implied?.id}
      title={implied?.text}
      onClick={onClick}
      className={`h-8 cursor-pointer rounded-xl border px-3.5 text-[12.5px] font-semibold transition-all duration-200 enabled:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default ${LOOKS[look]}`}
    >
      {children}
    </button>
  );
}

function Chips<T extends string>({
  label,
  options,
  value,
  implied = null,
  hint,
  nameOf,
  onChange,
}: {
  label: string;
  options: T[];
  value: T | null;
  implied?: T | null;
  hint?: string;
  nameOf: (option: T) => string;
  onChange: (next: T | null) => void;
}) {
  const hintId = useId();
  const lookOf = (option: T): Look => {
    if (value === option) return 'on';
    return value === null && implied === option ? 'implied' : 'off';
  };
  return (
    <div role="group" aria-label={label} className="flex gap-1.5">
      {options.map((option) => (
        <Chip
          key={option}
          look={lookOf(option)}
          hint={hint ? { id: hintId, text: hint } : undefined}
          onClick={() => onChange(value === option ? null : option)}
        >
          {nameOf(option)}
        </Chip>
      ))}
      {hint && (
        <span id={hintId} hidden>
          {hint}
        </span>
      )}
    </div>
  );
}

export function AddressPicker() {
  const { t } = useTranslation();
  const listener = useVoiceStore((s) => s.config.listener);
  const role = useVoiceStore((s) => s.config.relation.role);
  const patchListener = useVoiceStore((s) => s.patchListener);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Chips
          label={t('voice.you.gender.label')}
          options={GENDERS}
          value={listener.gender}
          nameOf={(gender) => t(`voice.you.gender.${gender}`)}
          onChange={(gender) => patchListener({ gender })}
        />
        <span aria-hidden className="h-5 w-px bg-ink/[0.08]" />
        <Chips
          label={t('voice.you.form.label')}
          options={FORMS}
          value={listener.address}
          implied={roleAddress(role)}
          hint={t('voice.you.form.implied')}
          nameOf={(address) => t(`voice.you.form.${address}`)}
          onChange={(address) => patchListener({ address })}
        />
      </div>
      <div className="max-w-[340px]">
        <LineField
          value={listener.name}
          max={NAME_MAX}
          label={t('voice.you.name')}
          icon={<AtSign size={13} />}
          onCommit={(name) => patchListener({ name })}
        />
      </div>
    </div>
  );
}
