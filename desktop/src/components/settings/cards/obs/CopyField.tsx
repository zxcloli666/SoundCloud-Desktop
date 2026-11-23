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
    <div className="flex items-center gap-2 rounded-[10px] border border-[color:var(--set-line)] bg-shade-20 py-1 pr-1 pl-3">
      {label && <span className="shrink-0 text-[11.5px] font-medium text-ink-40">{label}</span>}
      <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-70 select-all">
        {value}
      </code>
      <button type="button" onClick={copy} className={`set-btn h-7 ${copied ? 'text-ok' : ''}`}>
        {copied ? <Check size={13} strokeWidth={3} /> : <Copy size={13} />}
        {t(copied ? 'settings.obsCopied' : 'settings.obsCopy')}
      </button>
    </div>
  );
}
