import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from '../../../../lib/icons';

const COPIED_MS = 1600;

export function CopyField({ value, label }: { value: string; label?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard
      .writeText(value)
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-ink/[0.06] bg-shade-20 py-1.5 pr-1.5 pl-3">
      {label && (
        <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-30">
          {label}
        </span>
      )}
      <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-70 select-all">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
          copied
            ? 'bg-[#23a55a]/20 text-ok'
            : 'bg-ink/[0.06] text-ink-65 hover:bg-ink/[0.1] hover:text-ink-85'
        }`}
      >
        {copied ? <Check size={13} strokeWidth={3} /> : <Copy size={13} />}
        {t(copied ? 'settings.obsCopied' : 'settings.obsCopy')}
      </button>
    </div>
  );
}
