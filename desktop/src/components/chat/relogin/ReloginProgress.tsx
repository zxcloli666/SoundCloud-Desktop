import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ClipboardCopy, ExternalLink } from '../../../lib/icons';
import type { OAuthStep } from '../../../lib/use-oauth-flow';

const STEP_KEYS: Record<OAuthStep, string> = {
  waiting: 'chat.relogin.steps.waiting',
  token: 'chat.relogin.steps.token',
  extract: 'chat.relogin.steps.extract',
  finalizing: 'chat.relogin.steps.finalizing',
};

const LINK_BUTTON =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink/[0.04] hover:bg-ink/[0.08] border border-ink/[0.06] text-[11px] text-ink-50 hover:text-ink-75 transition-colors cursor-pointer';

interface ReloginProgressProps {
  step: OAuthStep;
  authUrl: string | null;
  hint: string | null;
  onReopen: () => void;
  onCancel: () => void;
}

export const ReloginProgress = memo(function ReloginProgress({
  step,
  authUrl,
  hint,
  onReopen,
  onCancel,
}: ReloginProgressProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!authUrl) return;
    navigator.clipboard.writeText(authUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-ink/[0.08] border-t-accent animate-spin" />
      <p className="text-[12px] text-ink-45 text-center">{t(STEP_KEYS[step])}</p>
      {hint && (
        <p className="max-w-[260px] text-center text-[11px] leading-snug text-amber-200/70">
          {hint}
        </p>
      )}
      {authUrl && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={onReopen} className={LINK_BUTTON}>
            <ExternalLink size={12} />
            {t('auth.reopenLink')}
          </button>
          <button type="button" onClick={copy} className={LINK_BUTTON}>
            {copied ? <Check size={12} /> : <ClipboardCopy size={12} />}
            {copied ? t('auth.copied') : t('auth.copyLink')}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="text-[11.5px] text-ink-35 hover:text-ink-65 transition-colors cursor-pointer"
      >
        {t('common.cancel')}
      </button>
    </div>
  );
});
