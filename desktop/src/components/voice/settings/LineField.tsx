import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../../../lib/icons';
import { oneLine } from '../../../lib/voice/chat/body';
import { Pill } from './Block';

function Counter({ count, max }: { count: number; max: number }) {
  return (
    <Pill tone={count >= max ? 'warn' : count > 0 ? 'accent' : 'muted'}>
      <span className="font-mono tabular-nums">
        {count}/{max}
      </span>
    </Pill>
  );
}

export function LineField({
  value,
  max,
  label,
  icon,
  counted = false,
  focus = false,
  onCommit,
}: {
  value: string;
  max: number;
  label: string;
  icon: ReactNode;
  counted?: boolean;
  focus?: boolean;
  onCommit: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (focus) input.current?.focus();
  }, [focus]);

  const commit = (text: string) => {
    const clean = oneLine(text, max);
    setDraft(clean);
    if (clean !== value) onCommit(clean);
  };

  return (
    <div className="group/line flex h-9 items-center gap-2 rounded-xl border border-ink/[0.08] bg-ink/[0.03] pl-3 pr-1.5 transition-colors duration-300 focus-within:border-accent/50 hover:border-ink/[0.14]">
      <span className="flex shrink-0 text-ink-30 transition-colors group-focus-within/line:text-accent">
        {icon}
      </span>
      <input
        ref={input}
        value={draft}
        maxLength={max}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        placeholder={label}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink-90 outline-none placeholder:text-ink-30 disabled:cursor-default"
      />
      {counted && <Counter count={draft.length} max={max} />}
      {draft && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => commit('')}
          aria-label={t('voice.you.clear')}
          title={t('voice.you.clear')}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-35 transition-colors duration-200 enabled:hover:bg-ink/[0.07] enabled:hover:text-ink-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:cursor-default"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
