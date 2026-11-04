import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { KeyRound, Loader2, RefreshCw } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { isLinux, isMac } from '../../../lib/platform';
import { GlassCard } from '../../ui/GlassCard';

const PENDING_MS = 4_000;
let retries = 0;

function vaultKey(): string {
  if (isMac()) return 'chat.relogin.keychain.mac';
  if (isLinux()) return 'chat.relogin.keychain.linux';
  return 'chat.relogin.keychain.windows';
}

export const KeychainCard = memo(function KeychainCard() {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const again = retries > 0;

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(false), PENDING_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  const retry = () => {
    if (pending) return;
    retries += 1;
    setFailed(false);
    setPending(true);
    chatBridge.keychainRetry().catch(() => {
      setPending(false);
      setFailed(true);
    });
  };

  return (
    <GlassCard
      data-ui="chat-keychain"
      padding={false}
      className="relative mx-auto w-full max-w-[380px] overflow-hidden"
    >
      {perf.bloom && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-1/2 h-28 w-3/4 -translate-x-1/2"
          style={{
            background:
              'radial-gradient(ellipse, color-mix(in srgb, var(--color-amber-400) 16%, transparent) 0%, transparent 70%)',
            contain: 'strict',
            transform: 'translateZ(0)',
          }}
        />
      )}
      <div
        className="relative flex flex-col items-center gap-4 px-6 py-6 text-center"
        style={{ isolation: 'isolate' }}
      >
        <div className="flex size-12 items-center justify-center rounded-2xl border border-ink/[0.08] bg-ink/[0.04]">
          <KeyRound size={20} className="text-amber-300" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[14.5px] font-semibold leading-snug text-ink-90">
            {t('chat.relogin.keychain.title')}
          </p>
          <p className="text-[12.5px] leading-snug text-ink-60">{t(vaultKey())}</p>
          <p className="text-[12px] text-ink-40">{t('chat.relogin.musicStays')}</p>
        </div>
        {(again || failed) && !pending && (
          <p
            role="status"
            className="w-full rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5 text-[12px] leading-snug text-ink-75"
          >
            {t(failed ? 'chat.relogin.keychain.failed' : 'chat.relogin.keychain.again')}
          </p>
        )}
        <button
          type="button"
          onClick={retry}
          disabled={pending}
          aria-busy={pending}
          className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink/[0.08] bg-ink/[0.06] text-[13px] font-semibold text-ink-85 transition-[transform,background-color] duration-200 ease-[var(--ease-apple)] hover:scale-[1.02] hover:bg-ink/[0.1] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-default disabled:opacity-60 disabled:hover:scale-100"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {t(pending ? 'chat.relogin.keychain.asking' : 'chat.relogin.retry')}
        </button>
      </div>
    </GlassCard>
  );
});
