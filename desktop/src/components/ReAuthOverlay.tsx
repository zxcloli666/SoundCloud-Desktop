import * as Dialog from '@radix-ui/react-dialog';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ClipboardCopy, Lock, Power, X } from '../lib/icons';
import { queryClient } from '../lib/query-client';
import { useOAuthFlow } from '../lib/use-oauth-flow';
import { useAuthStore } from '../stores/auth';
import { useSessionExpiryStore } from '../stores/session-expiry';

export const ReAuthOverlay = React.memo(() => {
  const { t } = useTranslation();
  const sessionExpired = useSessionExpiryStore((s) => s.sessionExpired);
  const setSessionExpired = useSessionExpiryStore((s) => s.setSessionExpired);
  const markReAuthed = useSessionExpiryStore((s) => s.markReAuthed);
  const setSession = useAuthStore((s) => s.setSession);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const logout = useAuthStore((s) => s.logout);
  const [copied, setCopied] = useState(false);

  const { startLogin, authUrl, isPolling, step } = useOAuthFlow((sessionId) => {
    markReAuthed();
    setSession(sessionId);
    setSessionExpired(false);
    fetchUser().catch(() => {});
    queryClient.invalidateQueries();
  });

  const stepLabel =
    step === 'token'
      ? t('auth.stepToken')
      : step === 'profile'
        ? t('auth.stepProfile')
        : step === 'session'
          ? t('auth.stepSession')
          : t('reauth.signingIn');

  const handleLogin = async () => {
    try {
      await startLogin();
    } catch (e) {
      console.error('Re-auth failed:', e);
    }
  };

  const handleLogout = () => {
    setSessionExpired(false);
    logout();
  };

  return (
    <Dialog.Root open={sessionExpired} onOpenChange={(open) => !open && setSessionExpired(false)}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[100] animate-in fade-in duration-200"
          style={{
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            contain: 'strict',
            transform: 'translateZ(0)',
          }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[101] w-[380px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl overflow-hidden outline-none animate-in fade-in zoom-in-95 duration-200"
          style={{
            background:
              'linear-gradient(165deg, rgba(22,14,38,0.97), rgba(14,10,28,0.98), rgba(10,8,22,0.99))',
            border: '0.5px solid rgba(255,255,255,0.08)',
            boxShadow:
              '0 25px 60px rgba(0,0,0,0.6), 0 0 50px rgba(var(--accent-rgb, 255,85,0),0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Ambient glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse, var(--color-accent-glow) 0%, transparent 70%)',
              transform: 'translateZ(0)',
            }}
          />

          <div className="relative p-7" style={{ isolation: 'isolate' }}>
            {/* Close */}
            <Dialog.Close className="absolute top-4 right-4 p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-colors cursor-pointer">
              <X size={14} />
            </Dialog.Close>

            {/* Icon */}
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
              <Dialog.Title className="text-lg font-bold text-white/90 tracking-tight">
                {t('reauth.title')}
              </Dialog.Title>
              <p className="text-[12.5px] text-white/35 mt-1.5 leading-relaxed max-w-[280px]">
                {t('reauth.description')}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2.5">
              {isPolling ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white/[0.06] border-t-accent animate-spin" />
                  <p className="text-[11.5px] text-white/45">{stepLabel}</p>
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
                          {t('reauth.copied')}
                        </>
                      ) : (
                        <>
                          <ClipboardCopy size={11} />
                          {t('reauth.copyLink')}
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  className="w-full py-3 rounded-xl bg-accent text-accent-contrast font-semibold text-[13px] hover:bg-accent-hover active:scale-[0.97] transition-all duration-200 cursor-pointer shadow-[0_0_30px_color-mix(in_srgb,var(--color-accent-glow)_100%,transparent),0_2px_8px_rgba(0,0,0,0.3)]"
                >
                  {t('reauth.signIn')}
                </button>
              )}

              {/* Logout secondary */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] text-white/25 hover:text-white/45 hover:bg-white/[0.03] transition-all cursor-pointer"
              >
                <Power size={12} />
                {t('reauth.logout')}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
