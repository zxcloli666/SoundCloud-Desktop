import {type ReactNode, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {AuthBackdrop} from '../components/auth/AuthBackdrop';
import {BrandMark} from '../components/auth/BrandMark';
import {OfflineEntryCard} from '../components/auth/OfflineEntryCard';
import {QrLinkSheet} from '../components/auth/QrLinkSheet';
import {
    AlertCircle,
    Check,
    ChevronRight,
    ClipboardCopy,
    RefreshCw,
    Smartphone,
} from '../lib/icons';
import {usePerfMode} from '../lib/perf';
import {queryClient} from '../lib/query-client';
import {useOAuthFlow} from '../lib/use-oauth-flow';
import {useAppStatusStore} from '../stores/app-status';
import {useAuthStore} from '../stores/auth';

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
    const perf = usePerfMode();
  const cardBlur = perf.blur(60);
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
      await setSession(sessionId);
    await fetchUser();
    queryClient.invalidateQueries();
  };

  const { startLogin, authUrl, isPolling, step, error } = useOAuthFlow(onLoginSuccess);

  const handleLogin = async () => {
    try {
      await startLogin();
    } catch (e) {
      console.error('Login failed:', e);
    }
  };

  const errorTitle = !error
    ? ''
    : error.kind === 'unreachable'
      ? t('auth.errorServerTitle')
      : error.kind === 'expired'
        ? t('auth.errorExpiredTitle')
        : t('auth.errorFailedTitle');
  const errorDesc =
    error?.kind === 'unreachable' ? t('auth.errorServerDesc') : (error?.message ?? '');

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
        <AuthBackdrop/>

        <div className="relative z-10 w-full max-w-[400px] mx-4" style={{isolation: 'isolate'}}>
            <div
                className="relative overflow-hidden rounded-[2.25rem] px-8 pt-9 pb-7"
                style={{
                    border: '0.5px solid rgba(255,255,255,0.1)',
                    background:
                        cardBlur > 0
                            ? 'linear-gradient(165deg, rgba(255,255,255,0.06), rgba(255,255,255,0.018) 60%, rgba(255,255,255,0.035))'
                            : 'rgba(18,18,22,0.85)',
                    backdropFilter: cardBlur > 0 ? `blur(${cardBlur}px) saturate(1.5)` : undefined,
                    WebkitBackdropFilter: cardBlur > 0 ? `blur(${cardBlur}px) saturate(1.5)` : undefined,
                    boxShadow:
                        '0 40px 100px rgba(0,0,0,0.55), 0 0 80px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
            >
          <span
              aria-hidden
              className="absolute inset-x-8 top-0 h-px"
              style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              }}
          />

                <BrandMark subtitle={isPolling ? t('auth.signingIn') : t('auth.tagline')}/>

                <div className="mt-8">
                    {error ? (
                        <div className="flex flex-col items-stretch gap-4">
                            <div
                                className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-5 py-5 text-center">
                                <div
                                    className="flex size-11 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10">
                                    <AlertCircle size={20} className="text-red-400" strokeWidth={1.8}/>
                                </div>
                                <div>
                                    <p className="text-[14px] font-semibold text-white/90">{errorTitle}</p>
                                    <p className="mt-1 text-[12px] leading-snug text-white/45 break-words">
                                        {errorDesc}
                                    </p>
                                </div>
                            </div>
                            <PrimaryButton onClick={handleLogin} idle={perf.idleAnim}>
                                <RefreshCw size={15} strokeWidth={2}/>
                                {t('auth.retry')}
                            </PrimaryButton>
                            <OfflineEntryCard onClick={handleEnterOffline}/>
                        </div>
                    ) : isPolling ? (
                        <div className="flex flex-col items-center gap-4 py-2">
                            <div
                                className="w-10 h-10 rounded-full border-2 border-white/[0.08] border-t-accent animate-spin"/>
                            <p className="text-[12px] text-white/45">{stepLabel}</p>
                            {authUrl && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(authUrl);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] text-white/40 hover:text-white/60 transition-all cursor-pointer"
                                >
                                    {copied ? (
                                        <>
                                            <Check size={12}/>
                                            {t('auth.copied')}
                                        </>
                                    ) : (
                                        <>
                                            <ClipboardCopy size={12}/>
                                            {t('auth.copyLink')}
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-stretch gap-3">
                            <PrimaryButton onClick={handleLogin} idle={perf.idleAnim}>
                                {t('auth.signIn')}
                                <ChevronRight size={16} strokeWidth={2.4}/>
                            </PrimaryButton>
                            <button
                                type="button"
                                onClick={() => setQrOpen(true)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12.5px] font-medium text-white/45 hover:text-white/80 hover:bg-white/[0.04] transition-all cursor-pointer"
                            >
                                <Smartphone size={14}/>
                                {t('qrLink.scanQr')}
                            </button>

                            <div
                                className="my-1 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-white/25">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10"/>
                                {t('auth.orSeparator')}
                                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10"/>
                            </div>

                            <OfflineEntryCard onClick={handleEnterOffline}/>
                        </div>
                    )}
                </div>
            </div>
      </div>

      <QrLinkSheet open={qrOpen} onOpenChange={setQrOpen} mode="pull" onSuccess={onLoginSuccess} />
    </div>
  );
}

/** Primary accent CTA with a sweeping shine. */
function PrimaryButton({
                           onClick,
                           idle,
                           children,
                       }: {
    onClick: () => void;
    idle: boolean;
    children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full h-12 overflow-hidden rounded-2xl text-sm font-bold cursor-pointer transition-transform duration-200 ease-[var(--ease-apple)] hover:scale-[1.02] active:scale-[0.97]"
      style={{
          color: 'var(--color-accent-contrast)',
          background: 'linear-gradient(180deg, var(--color-accent), var(--color-accent-hover))',
          boxShadow:
              '0 14px 40px var(--color-accent-glow), 0 0 30px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.28)',
      }}
    >
        {idle && (
            <span
                aria-hidden
                className="auth-anim absolute inset-y-0 left-0 w-1/3"
                style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                    animation: 'auth-shine 4.5s ease-in-out infinite',
                }}
            />
        )}
        <span className="relative flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}
