import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, ClipboardCopy } from '../../lib/icons';

export function UpdateCommands({ commands }: { commands: string[] }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (command: string) => {
    navigator.clipboard
      .writeText(command)
      .then(() => setCopied(command))
      .catch(() => toast.error(t('common.error')));
  };

  return (
    <div className="mt-2.5 space-y-1.5">
      {commands.map((command) => (
        <div
          key={command}
          className="flex items-center gap-2 rounded-lg bg-black/30 border border-white/[0.06] pl-3 pr-1 py-1"
        >
          <span className="shrink-0 font-mono text-[11px] text-accent/70 select-none">$</span>
          <code
            className="selectable flex-1 min-w-0 truncate font-mono text-[11px] text-white/75"
            title={command}
          >
            {command}
          </code>
          <button
            type="button"
            onClick={() => copy(command)}
            aria-label={t('update.copyCommand')}
            title={t('update.copyCommand')}
            className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white/85 hover:bg-white/[0.08] transition-all duration-200 cursor-pointer"
          >
            {copied === command ? (
              <Check size={12} className="text-accent" />
            ) : (
              <ClipboardCopy size={12} />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
