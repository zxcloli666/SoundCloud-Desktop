import { openUrl } from '@tauri-apps/plugin-opener';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, ClipboardCopy, ExternalLink } from '../../lib/icons';

const COPIED_RESET_MS = 1800;

interface CopyLineProps {
  text: string;
  action?: 'copy' | 'open';
  label?: string;
  step?: number;
}

export const CopyLine = React.memo(({ text, action = 'copy', label, step }: CopyLineProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const run = () => {
    if (action === 'open') {
      openUrl(text).catch(() => toast.error(t('common.error')));
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        toast.success(t('netCheck.copiedLine'));
      })
      .catch(() => toast.error(t('common.error')));
  };

  const hint = t(action === 'open' ? 'netCheck.manual.openBrowser' : 'netCheck.manual.copy');

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-black/20 border border-white/[0.06] pl-3 pr-1.5 py-1.5">
      {step !== undefined && (
        <span className="w-4 shrink-0 font-mono text-[10.5px] text-white/30">{step}</span>
      )}
      {label ? (
        <span className="flex-1 min-w-0 truncate text-[11.5px] text-white/70">{label}</span>
      ) : (
        <code
          className="flex-1 min-w-0 truncate text-[11.5px] text-white/70 font-mono select-text"
          title={text}
        >
          {text}
        </code>
      )}
      <button
        type="button"
        onClick={run}
        aria-label={hint}
        title={hint}
        className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white/85 hover:bg-white/[0.08] transition-all duration-200 cursor-pointer"
      >
        {action === 'open' ? (
          <ExternalLink size={14} />
        ) : copied ? (
          <Check size={14} className="text-[var(--color-accent)]" />
        ) : (
          <ClipboardCopy size={14} />
        )}
      </button>
    </div>
  );
});
