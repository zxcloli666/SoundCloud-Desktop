import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from '../../../lib/icons';
import type { LinkCode, SpeakerProvider } from '../../../lib/voice/remote-types';
import { countdown } from '../time';
import { SmallButton } from './Block';

export function LinkCodePanel({
  provider,
  code,
  onCancel,
  onExpired,
}: {
  provider: SpeakerProvider;
  code: LinkCode;
  onCancel: () => void;
  onExpired: () => void;
}) {
  const { t } = useTranslation();
  const expires = Date.parse(code.expires_at);
  const leftRef = useRef<HTMLSpanElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const tick = () => {
      const left = expires - Date.now();
      if (leftRef.current) leftRef.current.textContent = countdown(left);
      if (left <= 0) onExpired();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expires, onExpired]);

  const copy = () => {
    void navigator.clipboard?.writeText(code.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div
      data-ui="voice-link-code"
      className="mt-3 rounded-2xl border border-accent/30 bg-accent/[0.05] p-4"
    >
      <div
        className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
        aria-label={code.code}
      >
        {code.code.split('').map((digit, i) => (
          <span
            key={i}
            className={`flex h-12 w-10 items-center justify-center rounded-xl border border-ink/[0.12] bg-surface font-mono text-[24px] font-bold text-ink shadow-[0_6px_18px_-10px_rgb(var(--shade)/calc(0.5*var(--shade-alpha)))] ${i === 3 ? 'ml-2' : ''}`}
          >
            {digit}
          </span>
        ))}
      </div>
      <p className="mt-3 text-center text-[12px] leading-snug text-ink-60">
        {t(`voice.speakers.how.${provider}`)}
      </p>
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="mr-1 font-mono text-[12px] tabular-nums text-ink-45" ref={leftRef} />
        <SmallButton onClick={copy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? t('voice.speakers.copied') : t('voice.speakers.copy')}
        </SmallButton>
        <SmallButton onClick={onCancel}>{t('voice.speakers.cancel')}</SmallButton>
      </div>
    </div>
  );
}
