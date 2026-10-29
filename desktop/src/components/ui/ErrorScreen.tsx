import {useTranslation} from 'react-i18next';
import {AlertCircle, Home, RefreshCw} from '../../lib/icons';
import {ReportButton} from './ReportButton';

/** Premium crash screen shown by the ErrorBoundary. Dark, accent-lit glass,
 *  with retry / reload / home actions and a foldaway technical detail. */
export function ErrorScreen({
                                error,
                                onRetry,
                                fullscreen = false,
                            }: {
    error?: Error | null;
    onRetry?: () => void;
    fullscreen?: boolean;
}) {
    const {t} = useTranslation();
    const message = error?.message || String(error ?? '');

    return (
        <div
            className={`relative flex items-center justify-center overflow-hidden p-6 ${
                fullscreen ? 'h-screen' : 'min-h-full'
            }`}
            style={{background: fullscreen ? 'var(--bg-primary, #08080a)' : undefined}}
        >
            {/* atmosphere — two soft accent orbs */}
            <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
                <div
                    className="absolute -top-[20%] left-[12%] w-[55vw] h-[55vw] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, var(--color-accent), transparent 62%)',
                        opacity: 0.16,
                        filter: 'blur(120px)',
                    }}
                />
                <div
                    className="absolute -bottom-[24%] right-[8%] w-[48vw] h-[48vw] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, var(--color-accent), transparent 62%)',
                        opacity: 0.1,
                        filter: 'blur(130px)',
                    }}
                />
            </div>

            <div className="relative z-10 w-full max-w-[460px]">
                <div
                    className="relative overflow-hidden rounded-[2rem] p-8 text-center"
                    style={{
                        border: '0.5px solid rgba(255,255,255,0.1)',
                        background: 'linear-gradient(168deg, rgba(23,22,28,0.9), rgba(11,10,14,0.95))',
                        boxShadow:
                            '0 40px 100px rgba(0,0,0,0.55), 0 0 80px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.07)',
                    }}
                >
          <span
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px"
              style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              }}
          />

                    {/* emblem */}
                    <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
            <span
                aria-hidden
                className="absolute inset-0 rounded-full animate-ping"
                style={{background: 'var(--color-accent-glow)', animationDuration: '2.4s'}}
            />
                        <span
                            className="relative flex h-20 w-20 items-center justify-center rounded-[26px]"
                            style={{
                                color: 'var(--color-accent)',
                                background:
                                    'linear-gradient(150deg, var(--color-accent-glow), rgba(255,255,255,0.04))',
                                border: '0.5px solid var(--color-accent-glow)',
                                boxShadow:
                                    '0 0 30px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.18)',
                            }}
                        >
              <AlertCircle size={34} strokeWidth={1.8}/>
            </span>
                    </div>

                    <h1
                        className="text-[26px] font-black tracking-tight leading-tight"
                        style={{
                            backgroundImage:
                                'linear-gradient(100deg, #fff 0%, #fff 40%, var(--color-accent) 100%)',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                    >
                        {t('errors.title', 'Что-то пошло не так')}
                    </h1>
                    <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/45">
                        {t(
                            'errors.subtitle',
                            'Произошёл сбой при отрисовке. Можно попробовать снова или перезагрузить.',
                        )}
                    </p>

                    {message && (
                        <details className="group mt-5 text-left">
                            <summary
                                className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.16em] text-white/30 transition-colors hover:text-white/55">
                                <span className="text-[var(--color-accent)]">▸</span>{' '}
                                {t('errors.details', 'Подробности')}
                            </summary>
                            <pre
                                className="mt-2 max-h-40 overflow-auto rounded-xl border border-white/[0.06] bg-black/40 p-3 text-[11px] leading-relaxed text-red-300/80 whitespace-pre-wrap break-words">
                {message}
              </pre>
                        </details>
                    )}

                    <div className="mt-7 flex flex-col gap-2.5">
                        {onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-sm font-bold transition-transform duration-200 hover:scale-[1.02] active:scale-[0.97] cursor-pointer"
                                style={{
                                    color: 'var(--color-accent-contrast)',
                                    background:
                                        'linear-gradient(180deg, var(--color-accent), var(--color-accent-hover))',
                                    boxShadow:
                                        '0 12px 34px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.25)',
                                }}
                            >
                                <RefreshCw size={16} strokeWidth={2.2}/>
                                {t('errors.retry', 'Попробовать снова')}
                            </button>
                        )}
                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] text-[13px] font-semibold text-white/70 transition-all hover:bg-white/[0.08] hover:text-white/90 active:scale-[0.97] cursor-pointer"
                            >
                                <RefreshCw size={14}/>
                                {t('errors.reload', 'Перезагрузить')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    window.location.assign('/');
                                }}
                                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] text-[13px] font-semibold text-white/70 transition-all hover:bg-white/[0.08] hover:text-white/90 active:scale-[0.97] cursor-pointer"
                            >
                                <Home size={14}/>
                                {t('errors.home', 'На главную')}
                            </button>
                        </div>
                        <ReportButton trigger="render"/>
                    </div>
                </div>
            </div>
        </div>
    );
}
