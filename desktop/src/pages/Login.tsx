import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { QrLinkSheet } from '../components/auth/QrLinkSheet';
import {
  Check,
  ChevronRight,
  ClipboardCopy,
  Disc3,
  Download,
  Globe,
  Smartphone,
} from '../lib/icons';
import { queryClient } from '../lib/query-client';
import { useOAuthFlow } from '../lib/use-oauth-flow';
import { useAppStatusStore } from '../stores/app-status';
import { useAuthStore } from '../stores/auth';

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const setOfflineBypass = useAppStatusStore((s) => s.setOfflineBypass);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const handleEnterOffline = () => {
    setOfflineBypass(true);
    navigate('/offline', { replace: true });
  };

  const onLoginSuccess = async (sessionId: string) => {
    setSession(sessionId);
    await fetchUser();
    queryClient.invalidateQueries();
  };

  const { startLogin, authUrl, isPolling, step } = useOAuthFlow(onLoginSuccess);

  const handleLogin = async () => {
    try {
      await startLogin();
    } catch (e) {
      console.error('Login failed:', e);
    }
  };

  const stepLabel =
    step === 'token'
      ? t('auth.stepToken')
      : step === 'profile'
        ? t('auth.stepProfile')
        : step === 'session'
          ? t('auth.stepSession')
          : t('auth.stepWaiting');

  return (
    <div className="h-screen flex items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ contain: 'strict', transform: 'translateZ(0)' }}
      >
        <div className="absolute top-[18%] left-[14%] w-[520px] h-[520px] rounded-full bg-accent/[0.10] blur-[160px]" />
        <div className="absolute bottom-[12%] right-[10%] w-[460px] h-[460px] rounded-full bg-sky-400/[0.08] blur-[160px]" />
        <div className="absolute top-[55%] left-[55%] w-[360px] h-[360px] rounded-full bg-purple-500/[0.06] blur-[140px]" />
      </div>

      <div
        className="relative flex flex-col items-center gap-7 max-w-sm w-full mx-4"
        style={{ isolation: 'isolate' }}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-accent/25 blur-2xl rounded-full scale-150" />
          <div className="liquid-panel relative flex h-20 w-20 items-center justify-center rounded-[26px]">
            <Disc3 size={36} className="text-accent" strokeWidth={1.5} />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">SoundCloud Desktop</h1>
          <p className="text-[13px] text-white/35 mt-2">
            {isPolling ? t('auth.signingIn') : t('auth.tagline')}
          </p>
        </div>

        {isPolling ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-white/[0.06] border-t-accent animate-spin" />
            <p className="text-[12px] text-white/40">{stepLabel}</p>
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
                    <Check size={12} />
                    {t('auth.copied')}
                  </>
                ) : (
                  <>
                    <ClipboardCopy size={12} />
                    {t('auth.copyLink')}
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-stretch gap-3 w-full">
            <button
              type="button"
              onClick={handleLogin}
              className="liquid-button-primary w-full cursor-pointer rounded-[22px] py-3.5 text-sm font-semibold text-accent-contrast transition-all duration-200 ease-[var(--ease-apple)] hover:scale-[1.01] active:scale-[0.97]"
            >
              {t('auth.signIn')}
            </button>
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="liquid-control flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-[18px] py-2.5 text-[12px] text-white/58 transition-all hover:text-white/82"
            >
              <Smartphone size={13} />
              {t('qrLink.scanQr')}
            </button>

            <div className="my-1 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-white/25">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
              {t('auth.orSeparator')}
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
            </div>

            <OfflineEntryCard onClick={handleEnterOffline} />
          </div>
        )}
      </div>
      <QrLinkSheet open={qrOpen} onOpenChange={setQrOpen} mode="pull" onSuccess={onLoginSuccess} />
    </div>
  );
}

function OfflineEntryCard({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="liquid-panel group relative w-full cursor-pointer rounded-[24px] p-[1px] text-left transition-all duration-300 ease-[var(--ease-apple)] active:scale-[0.985]"
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.18),transparent_55%)] opacity-80"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -inset-px rounded-[22px] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden="true"
      />

      <span className="relative flex items-center gap-3 rounded-[21px] bg-black/35 px-4 py-3.5 backdrop-blur-[40px]">
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-[16px] border border-white/[0.16] bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_rgba(0,0,0,0.25)]">
          <Globe size={18} className="text-sky-100/95" strokeWidth={1.7} />
          <span className="absolute -bottom-1 -right-1 flex size-[18px] items-center justify-center rounded-full border border-white/[0.18] bg-emerald-400/90 shadow-[0_2px_6px_rgba(16,185,129,0.45)]">
            <Download size={10} strokeWidth={3} className="text-emerald-950" />
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold tracking-tight text-white/92">
            {t('auth.continueOffline')}
          </span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-white/45">
            {t('auth.continueOfflineDesc')}
          </span>
        </span>

        <ChevronRight
          size={16}
          className="shrink-0 text-white/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white/70"
        />
      </span>
    </button>
  );
}
