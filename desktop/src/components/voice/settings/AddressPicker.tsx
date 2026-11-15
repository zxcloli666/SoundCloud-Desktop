import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NAME_MAX } from '../../../lib/voice/chat/body';
import { useVoiceStore } from '../../../lib/voice/store';
import type { Address, ListenerGender } from '../../../lib/voice/types';
import { AtSign } from '../icons';
import { LineField } from './LineField';

const GENDERS: ListenerGender[] = ['male', 'female'];
const FORMS: Address[] = ['informal', 'formal'];

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-8 cursor-pointer rounded-xl border px-3.5 text-[12.5px] font-semibold transition-all duration-200 enabled:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default ${
        on
          ? 'border-accent/50 bg-accent/[0.08] text-ink-90'
          : 'border-ink/[0.06] bg-ink/[0.02] text-ink-45 enabled:hover:bg-ink/[0.06] enabled:hover:text-ink-70'
      }`}
    >
      {children}
    </button>
  );
}

function Chips<T extends string>({
  label,
  options,
  value,
  nameOf,
  onChange,
}: {
  label: string;
  options: T[];
  value: T | null;
  nameOf: (option: T) => string;
  onChange: (next: T | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1.5">
      {options.map((option) => (
        <Chip
          key={option}
          on={value === option}
          onClick={() => onChange(value === option ? null : option)}
        >
          {nameOf(option)}
        </Chip>
      ))}
    </div>
  );
}

export function AddressPicker() {
  const { t } = useTranslation();
  const listener = useVoiceStore((s) => s.config.listener);
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
