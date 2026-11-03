import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DISCORD_URL } from '../../lib/constants';
import { type ReportResult, type ReportTrigger, sendReport } from '../../lib/diag';
import { Check, FolderOpen, LifeBuoy, MessageCircle, RefreshCw } from '../../lib/icons';

type Phase = { name: 'idle' } | { name: 'sending' } | { name: 'done'; result: ReportResult };

const BUTTON =
  'flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-ink/[0.1] bg-ink/[0.04] text-[13px] font-semibold text-ink-70 transition-all hover:bg-ink/[0.08] hover:text-ink-90 active:scale-[0.97] cursor-pointer disabled:opacity-50 disabled:cursor-default';

export function ReportButton({
  trigger,
  className = BUTTON,
  discordAfter = false,
}: {
  trigger: ReportTrigger;
  className?: string;
  discordAfter?: boolean;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });

  const openDiscord = () => void openUrl(DISCORD_URL).catch(() => undefined);

  const send = async () => {
    setPhase({ name: 'sending' });
    try {
      const result = await sendReport(trigger);
      if ('code' in result) {
        await navigator.clipboard.writeText(result.code).catch(() => undefined);
        if (discordAfter) openDiscord();
      }
      setPhase({ name: 'done', result });
    } catch {
      setPhase({ name: 'idle' });
    }
  };

  if (phase.name === 'done' && 'code' in phase.result) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-ink/[0.08] bg-shade-25 p-4">
        <div className="flex items-center gap-2.5">
          <span
            className="select-text font-mono text-[26px] font-black tracking-[0.08em]"
            style={{ color: 'var(--color-accent)' }}
          >
            {phase.result.code}
          </span>
          <Check size={20} className="text-emerald-400" />
        </div>
        <button type="button" onClick={openDiscord} className={className}>
          <MessageCircle size={14} />
          {t('diag.openDiscord')}
        </button>
      </div>
    );
  }

  if (phase.name === 'done') {
    const file = 'file' in phase.result ? phase.result.file : '';
    return (
      <div className="flex flex-col gap-2.5 rounded-2xl border border-ink/[0.08] bg-shade-25 p-4">
        <code className="select-text break-all font-mono text-[11.5px] text-ink-70">{file}</code>
        <button
          type="button"
          onClick={() => void revealItemInDir(file).catch(() => undefined)}
          className={className}
        >
          <FolderOpen size={14} />
          {t('diag.reveal')}
        </button>
        <p className="text-center text-[12px] text-ink-45">{t('diag.attach')}</p>
      </div>
    );
  }

  const sending = phase.name === 'sending';
  return (
    <button type="button" onClick={() => void send()} disabled={sending} className={className}>
      {sending ? <RefreshCw size={14} className="animate-spin" /> : <LifeBuoy size={14} />}
      {sending ? t('diag.sending') : t('diag.send')}
    </button>
  );
}
