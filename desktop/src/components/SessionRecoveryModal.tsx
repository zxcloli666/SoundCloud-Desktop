import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { completeReauth, retryRenew } from '../lib/auth-recovery';
import { Check, ClipboardCopy, ExternalLink, Lock, Power, RefreshCw, X } from '../lib/icons';
import { useOAuthFlow } from '../lib/use-oauth-flow';
import { useAuthStore } from '../stores/auth';
import { useAuthRecoveryStore } from '../stores/auth-recovery';
import { oauthErrorText } from './auth/oauth-error';
import { Modal, ModalClose, ModalContent, ModalTitle } from './ui/Modal';

export const SessionRecoveryModal = React.memo(() => {
  const { t } = useTranslation();
  const phase = useAuthRecoveryStore((s) => s.phase);
  const busy = useAuthRecoveryStore((s) => s.busy);
  const lastFailure = useAuthRecoveryStore((s) => s.lastFailure);
  const reset = useAuthRecoveryStore((s) => s.reset);
  const setOauthActive = useAuthRecoveryStore((s) => s.setOauthActive);
  const logout = useAuthStore((s) => s.logout);
  const hasSession = useAuthStore((s) => s.hasSession);
  const [copied, setCopied] = useState(false);

  const { retry, reopen, authUrl, isPolling, step, error, browserFailed, callbackSlow, cancel } =
    useOAuthFlow(completeReauth);

  // Пока идёт OAuth-поллинг — фоновый успех не должен авто-закрывать модалку.
  useEffect(() => {
    setOauthActive(isPolling);
    return () => setOauthActive(false);
  }, [isPolling, setOauthActive]);

  // Гейт `hasSession` обязателен: без сессии на экране уже стоит логин со своим
  // QR/OAuth, и модалка «войдите заново» поверх него — мусор, предлагающий ровно
  // то, что и так на экране. Восстанавливать нечего, если восстанавливать нечего.
  const open = phase === 'modal' && hasSession;
  // Пока крутится renew или идёт OAuth-поллинг — модалку не закрываем.
  const locked = busy || isPolling;

  useEffect(() => {
    if (!open) cancel();
  }, [open, cancel]);

  const stepLabel =
    step === 'token'
      ? t('auth.stepToken')
      : step === 'extract'
        ? t('auth.stepProfile')
        : step === 'finalizing'
          ? t('auth.stepSession')
          : t('recovery.signingIn');

  const loginError = error ? oauthErrorText(error, t) : null;
  const renewError =
    lastFailure === 'dead'
      ? t('recovery.errorDead')
      : lastFailure === 'transient'
        ? t('recovery.errorTransient')
        : null;

  const handleRenew = () => {
    cancel();
    void retryRenew();
  };

  const handleLogout = () => {
    reset();
    void logout();
  };

  let bodyState: 'oauth' | 'renewing' | 'actions';
  if (isPolling) bodyState = 'oauth';
  else if (busy) bodyState = 'renewing';
  else bodyState = 'actions';

  return (
    <Modal open={open} onOpenChange={(o) => !o && !locked && reset()}>
      <ModalContent size="sm" zClass="z-[100]" showClose={false}>
        <div className="relative p-7" style={{ isolation: 'isolate' }}>
          {/* Close */}
          <ModalClose
            disabled={locked}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
          >
            <X size={14} />
          </ModalClose>

          {/* Icon + title */}
          <div className="flex flex-col items-center text-center mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                border: '0.5px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              <Lock size={24} className="text-white/60" />
            </div>
            <ModalTitle className="text-lg font-bold text-white/90 tracking-tight">
              {t('recovery.title')}
            </ModalTitle>
            <p className="text-[12.5px] text-white/35 mt-1.5 leading-relaxed max-w-[280px]">
              {t('recovery.description')}
            </p>
          </div>

          {/* Body */}
          <div className="space-y-2.5">
            {bodyState === 'oauth' && (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-full border-2 border-white/[0.06] border-t-accent animate-spin" />
                <p className="text-[11.5px] text-white/45">{stepLabel}</p>
                {browserFailed && (
                  <p className="max-w-[260px] text-center text-[11px] leading-snug text-amber-200/70">
                    {t('auth.browserFailed')}
                  </p>
                )}
                {callbackSlow && !browserFailed && (
                  <>
                    <p className="max-w-[260px] text-center text-[11px] leading-snug text-amber-200/70">
                      {t('auth.callbackSlow')}
                    </p>
                    <button
                      type="button"
                      onClick={reopen}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] text-white/45 hover:text-white/65 transition-all cursor-pointer"
                    >
                      <ExternalLink size={11} />
                      {t('auth.reopenLink')}
                    </button>
                  </>
                )}
                {authUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(authUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] text-white/30 hover:text-white/50 transition-all cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check size={11} />
                        {t('recovery.copied')}
                      </>
                    ) : (
                      <>
                        <ClipboardCopy size={11} />
                        {t('recovery.copyLink')}
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={cancel}
                  className="text-[11px] text-white/30 hover:text-white/55 transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}

            {bodyState === 'renewing' && (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-full border-2 border-white/[0.06] border-t-accent animate-spin" />
                <p className="text-[11.5px] text-white/45">{t('recovery.renewing')}</p>
              </div>
            )}

            {bodyState === 'actions' && (
              <>
                {loginError ? (
                  <div className="pb-1 text-center">
                    <p className="text-[12px] font-semibold text-red-300/85">{loginError.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-white/40 break-words">
                      {loginError.desc}
                    </p>
                  </div>
                ) : (
                  renewError && (
                    <p className="pb-1 text-center text-[11.5px] leading-snug text-red-300/85">
                      {renewError}
                    </p>
                  )
                )}
                <button
                  type="button"
                  onClick={retry}
                  className="w-full py-3 rounded-xl bg-accent text-accent-contrast font-semibold text-[13px] hover:bg-accent-hover active:scale-[0.97] transition-all duration-200 cursor-pointer shadow-[0_0_30px_var(--color-accent-glow),0_2px_8px_rgba(0,0,0,0.3)]"
                >
                  {t('recovery.signIn')}
                </button>
                <button
                  type="button"
                  onClick={handleRenew}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[12.5px] text-white/55 hover:text-white/80 transition-all cursor-pointer"
                >
                  <RefreshCw size={13} />
                  {t('recovery.retry')}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] text-white/25 hover:text-white/45 hover:bg-white/[0.03] transition-all cursor-pointer"
                >
                  <Power size={12} />
                  {t('recovery.logout')}
                </button>
              </>
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
});
