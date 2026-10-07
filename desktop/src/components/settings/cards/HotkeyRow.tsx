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
  status,
  validate,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  status: HotkeyStatus | undefined;
  validate: (chord: KeyChord) => string | null;
  onChange: (accelerator: string) => void;
}) {
  const { t } = useTranslation();
  const [problem, setProblem] = useState<string | null>(null);
  const failure = value && status && status !== 'active' ? t(`hotkeys.status.${status}`) : null;
  const message = problem ?? failure;

  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.04] border border-white/[0.06] text-white/55">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[13px] text-white/80 font-medium">
          {label}
          {value && status === 'active' && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
              title={t('hotkeys.status.active')}
            />
          )}
        </div>
        {message && (
          <p
            className={`text-[11px] mt-0.5 leading-snug ${problem ? 'text-amber-300/80' : 'text-red-400/85'}`}
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
        className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white/35 hover:text-white/80 hover:bg-white/[0.08] transition-all duration-200 cursor-pointer disabled:opacity-0 disabled:pointer-events-none"
      >
        <X size={13} />
      </button>
    </div>
  );
}
