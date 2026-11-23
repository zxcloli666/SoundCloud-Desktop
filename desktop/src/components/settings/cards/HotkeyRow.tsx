import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { KeyChord } from '../../../lib/hotkeys/accelerator';
import type { HotkeyStatus } from '../../../lib/hotkeys/runtime';
import { X } from '../../../lib/icons';
import { HotkeyRecorder } from './HotkeyRecorder';

export function HotkeyRow({
  icon,
  label,
  value,
  dim = false,
  status,
  validate,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  dim?: boolean;
  status: HotkeyStatus | undefined;
  validate: (chord: KeyChord) => string | null;
  onChange: (accelerator: string) => void;
}) {
  const { t } = useTranslation();
  const [problem, setProblem] = useState<string | null>(null);
  const failure = value && status && status !== 'active' ? t(`hotkeys.status.${status}`) : null;
  const message = problem ?? failure;

  return (
    <div
      className={`set-row flex min-h-[52px] items-center gap-3 py-2 transition-opacity duration-200 ${
        dim ? 'opacity-50' : ''
      }`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--set-well)] text-ink-55">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink-90">
          <span className="truncate">{label}</span>
          {value && status === 'active' && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok"
              title={t('hotkeys.status.active')}
            />
          )}
        </div>
        {message && (
          <p
            className={`mt-0.5 text-[11.5px] leading-snug ${problem ? 'text-amber-400' : 'text-bad'}`}
          >
            {message}
          </p>
        )}
      </div>
      <HotkeyRecorder
        value={value}
        label={label}
        validate={validate}
        onChange={onChange}
        onProblem={setProblem}
      />
      <button
        type="button"
        onClick={() => {
          setProblem(null);
          onChange('');
        }}
        disabled={!value}
        aria-label={t('hotkeys.clear')}
        title={t('hotkeys.clear')}
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[9px] text-ink-35 transition-colors duration-150 hover:bg-[var(--set-well)] hover:text-ink-85 disabled:pointer-events-none disabled:opacity-0"
      >
        <X size={13} />
      </button>
    </div>
  );
}
