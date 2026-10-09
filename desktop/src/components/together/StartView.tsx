import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2, Radio, Users } from '../../lib/icons';
import { CODE_LENGTH, sessionErrorKey } from '../../lib/together/errors';
import { hostSession, joinSession } from '../../lib/together/session';
import { useTogetherStore } from '../../stores/together';
import { CodeInput } from './CodeInput';

type Busy = 'host' | 'join' | null;

export function StartView() {
  const { t } = useTranslation();
  const connecting = useTogetherStore((s) => s.phase === 'connecting');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    action()
      .catch((e: unknown) => setError(sessionErrorKey(e)))
      .finally(() => setBusy(null));
  };

  const join = () => {
    if (code.length === CODE_LENGTH) run('join', () => joinSession(code));
  };

  return (
    <div className="relative">
      <div className="flex flex-col items-center px-2 pt-2 pb-4 text-center">
        <div className="relative mb-3 flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-accent/30 animate-[sw-pulse-ring_2.8s_var(--ease-apple)_infinite]" />
          <span className="absolute inset-2 rounded-full border border-accent/20 animate-[sw-pulse-ring_2.8s_var(--ease-apple)_1.4s_infinite]" />
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent/90 to-accent/50 text-accent-contrast shadow-[0_0_28px_-4px_var(--color-accent-glow)]">
            <Users size={20} strokeWidth={2.2} />
          </span>
        </div>
        <p className="text-[15px] font-semibold text-white/95">{t('together.title')}</p>
        <p className="mt-1 max-w-[260px] text-[12px] leading-snug text-white/45">
          {t('together.pitch')}
        </p>
      </div>

      <button
        type="button"
        disabled={busy != null || connecting}
        onClick={() => run('host', hostSession)}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-accent-contrast shadow-[0_0_20px_var(--color-accent-glow)] transition-all duration-200 hover:bg-accent-hover active:scale-[0.98] disabled:cursor-default disabled:opacity-60"
      >
        {busy === 'host' ? <Loader2 size={15} className="animate-spin" /> : <Radio size={15} />}
        {t('together.start')}
      </button>

      <div className="my-3.5 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/[0.07]" />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/30">
          {t('together.orJoin')}
        </span>
        <span className="h-px flex-1 bg-white/[0.07]" />
      </div>

      <div className="flex items-center gap-2">
        <CodeInput
          value={code}
          onChange={(value) => {
            setCode(value);
            setError(null);
          }}
          onSubmit={join}
          disabled={busy != null}
          invalid={error != null && busy == null}
        />
        <button
          type="button"
          title={t('together.join')}
          aria-label={t('together.join')}
          disabled={code.length !== CODE_LENGTH || busy != null}
          onClick={join}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-white/[0.08] text-white/80 transition-all duration-200 hover:bg-white/[0.14] hover:text-white active:scale-95 disabled:cursor-default disabled:opacity-35"
        >
          {busy === 'join' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ArrowRight size={16} />
          )}
        </button>
      </div>

      <p
        className={`mt-2.5 min-h-[16px] text-center text-[11px] ${error ? 'text-rose-300/90' : 'text-white/30'}`}
      >
        {error ? t(error) : t('together.footnote')}
      </p>
    </div>
  );
}
