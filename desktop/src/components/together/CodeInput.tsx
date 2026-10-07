import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CODE_LENGTH, cleanCode } from '../../lib/together/errors';

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  invalid?: boolean;
}

export function CodeInput({ value, onChange, onSubmit, disabled, invalid }: CodeInputProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const cells = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? '');
  const caret = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <div className="relative flex-1" onClick={() => input.current?.focus()}>
      <input
        ref={input}
        value={value}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        aria-label={t('together.codeLabel')}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(cleanCode(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.length === CODE_LENGTH) onSubmit();
        }}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div className="flex gap-1.5">
        {cells.map((char, i) => {
          const active = focused && i === caret && value.length < CODE_LENGTH;
          return (
            <div
              key={i}
              className={`flex h-10 flex-1 items-center justify-center rounded-[10px] border font-mono text-[17px] font-semibold transition-all duration-200 ease-[var(--ease-apple)] ${
                invalid
                  ? 'border-rose-400/50 bg-rose-400/[0.06] text-rose-200'
                  : active
                    ? 'border-accent/70 bg-accent/[0.08] text-white shadow-[0_0_14px_-4px_var(--color-accent-glow)]'
                    : char
                      ? 'border-white/[0.14] bg-white/[0.06] text-white'
                      : 'border-white/[0.07] bg-white/[0.025] text-white/25'
              }`}
            >
              {char || (active ? <span className="h-4 w-px animate-pulse bg-accent" /> : '')}
            </div>
          );
        })}
      </div>
    </div>
  );
}
