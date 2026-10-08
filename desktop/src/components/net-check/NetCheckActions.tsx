import { openUrl } from '@tauri-apps/plugin-opener';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DISCORD_URL } from '../../lib/constants';
import { Check, ClipboardCopy, RefreshCw, Send } from '../../lib/icons';
import { reportText, useNetCheckStore, useShownVerdict } from '../../lib/net/check';

const COPIED_RESET_MS = 1800;
const PRIMARY =
  'w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-contrast font-semibold text-[13px] hover:bg-accent-hover active:scale-[0.97] transition-all duration-200 cursor-pointer shadow-[0_0_30px_var(--color-accent-glow),0_2px_8px_rgba(0,0,0,0.3)] disabled:opacity-50 disabled:cursor-default';
const SECONDARY =
  'w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[12.5px] text-white/55 hover:text-white/80 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default';

export const NetCheckActions = React.memo(() => {
  const { t } = useTranslation();
  const running = useNetCheckStore((s) => s.running);
  const hasReport = useNetCheckStore((s) => s.report !== null);
  const runCheck = useNetCheckStore((s) => s.runCheck);
  const verdict = useShownVerdict();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(await reportText());
      setCopied(true);
      return true;
    } catch {
      toast.error(t('common.error'));
      return false;
    }
  };

  const copyReport = () => {
    void copy().then((done) => done && toast.success(t('netCheck.copied')));
  };

  const send = () => {
    void copy().then((done) => {
      if (!done) return;
      toast.success(t('netCheck.sent'));
      openUrl(DISCORD_URL).catch(() => toast.error(t('common.error')));
    });
  };

  const idle = !running && hasReport;
  const problem = verdict !== 'ok' && verdict !== 'checking';

  return (
    <div className="mt-6 space-y-2.5">
      <button
        type="button"
        onClick={send}
        disabled={!idle}
        className={problem ? PRIMARY : SECONDARY}
      >
        <Send size={13} />
        {t('netCheck.send')}
      </button>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={copyReport} disabled={!idle} className={SECONDARY}>
          {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
          {t('netCheck.copy')}
        </button>
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={running}
          className={SECONDARY}
        >
          <RefreshCw size={12} className={running ? 'animate-spin' : undefined} />
          {t('netCheck.again')}
        </button>
      </div>
    </div>
  );
});
