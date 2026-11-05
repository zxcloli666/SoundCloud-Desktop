import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { type KeychainReason, keychainText, resetLinkText } from '../../../lib/chat/gate';
import { KeyRound, Loader2, RefreshCw } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { desktopOs } from '../../../lib/platform';
import { useChatStore } from '../../../stores/chat';
import { GlassCard } from '../../ui/GlassCard';
import { ResetKeysDialog } from './ResetKeysDialog';

let retries = 0;

export const KeychainCard = memo(function KeychainCard({ reason }: { reason: KeychainReason }) {
  const { t } = useTranslation();
  const base =
    reason === 'keychain_unavailable'
      ? 'chat.relogin.keychain.unavailable'
      : 'chat.relogin.keychain';
  const perf = usePerfMode();
  const status = useChatStore((state) => state.status);
  const storage = status?.keyStorage ?? 'os';
  const [askedAt, setAskedAt] = useState<typeof status | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const pending = askedAt === status;
  const again = retries > 0;

  const retry = () => {
    if (pending) return;
    retries += 1;
    setFailed(false);
    setAskedAt(status);
    chatBridge.keychainRetry().catch(() => {
      setAskedAt(undefined);
      setFailed(true);
    });
  };

  return (
    <GlassCard
      data-ui="chat-keychain"
      data-reason={reason}
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
            {t(`${base}.title`)}
          </p>
          <p className="text-[12.5px] leading-snug text-ink-60">
            {t(keychainText(reason, storage, desktopOs()))}
          </p>
          <p className="text-[12px] text-ink-40">{t('chat.relogin.musicStays')}</p>
        </div>
        {(again || failed) && !pending && (
          <p
            role="status"
            className="w-full rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5 text-[12px] leading-snug text-ink-75"
          >
            {t(failed ? 'chat.relogin.keychain.failed' : `${base}.again`)}
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
          {t(pending ? `${base}.asking` : 'chat.relogin.retry')}
        </button>
        <button
          type="button"
          data-ui="chat-keys-reset-open"
          onClick={() => setResetting(true)}
          className="-mt-1 cursor-pointer rounded-lg px-2 py-1 text-[12px] font-medium text-ink-45 underline decoration-ink/20 underline-offset-4 outline-none transition-colors duration-200 hover:text-ink-75 hover:decoration-ink/40 focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {t(resetLinkText(storage))}
        </button>
      </div>
      <ResetKeysDialog open={resetting} onClose={() => setResetting(false)} />
    </GlassCard>
  );
});
