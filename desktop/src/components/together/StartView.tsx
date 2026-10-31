import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronRight, Globe, Loader2, Lock, Users } from '../../lib/icons';
import { CODE_LENGTH, sessionErrorKey } from '../../lib/together/errors';
import { hostSession, joinSession } from '../../lib/together/session';
import { useSettingsStore } from '../../stores/settings';
import { useTogetherStore } from '../../stores/together';
import { AccessChoice } from './AccessChoice';
import { CodeInput } from './CodeInput';
import { OpenRooms } from './OpenRooms';
import { useOpenRooms } from './useOpenRooms';

type Busy = 'host' | 'join' | null;

export function StartView() {
  const { t } = useTranslation();
  const connecting = useTogetherStore((s) => s.phase === 'connecting');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const open = useOpenRooms(browsing);
  const access = useSettingsStore((s) => s.roomAccess);
  const setAccess = useSettingsStore((s) => s.setRoomAccess);
  const goPublic = open.available && access === 'public';
  const StartIcon = goPublic ? Globe : Lock;

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

  if (browsing && open.available) {
    return <OpenRooms list={open} onBack={() => setBrowsing(false)} />;
  }

  return (
    <div className="relative">
      <div className="flex flex-col items-center px-2 pt-2 pb-3.5 text-center">
        <div className="relative mb-3 flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-accent/30 animate-[sw-pulse-ring_2.8s_var(--ease-apple)_infinite]" />
          <span className="absolute inset-2 rounded-full border border-accent/20 animate-[sw-pulse-ring_2.8s_var(--ease-apple)_1.4s_infinite]" />
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent/90 to-accent/50 text-accent-contrast shadow-[0_0_28px_-4px_var(--color-accent-glow)]">
            <Users size={20} strokeWidth={2.2} />
          </span>
        </div>
        <p className="text-[15px] font-semibold text-ink-95">{t('together.title')}</p>
        <p className="mt-1 max-w-[260px] text-[12px] leading-snug text-ink-45">
          {t('together.pitch')}
        </p>
      </div>

      {open.available && (
        <AccessChoice value={access} onChange={setAccess} disabled={busy != null || connecting} />
      )}

      <button
        type="button"
        disabled={busy != null || connecting}
        onClick={() => run('host', () => hostSession(goPublic))}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-accent-contrast shadow-[0_0_20px_var(--color-accent-glow)] transition-all duration-200 hover:bg-accent-hover active:scale-[0.98] disabled:cursor-default disabled:opacity-60"
      >
        {busy === 'host' ? <Loader2 size={15} className="animate-spin" /> : <StartIcon size={15} />}
        {t(goPublic ? 'together.startPublic' : 'together.startPrivate')}
      </button>

      <div className="my-3.5 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink/[0.07]" />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-30">
          {t('together.orJoin')}
        </span>
        <span className="h-px flex-1 bg-ink/[0.07]" />
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
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-ink/[0.08] text-ink-80 transition-all duration-200 hover:bg-ink/[0.14] hover:text-ink active:scale-95 disabled:cursor-default disabled:opacity-35"
        >
          {busy === 'join' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ArrowRight size={16} />
          )}
        </button>
      </div>

      <p
        className={`mt-2.5 min-h-[16px] text-center text-[11px] ${error ? 'text-rose-300/90' : 'text-ink-30'}`}
      >
        {error ? t(error) : t('together.footnote')}
      </p>

      {open.available && (
        <button
          type="button"
          onClick={() => setBrowsing(true)}
          className="mt-3 flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-ink/[0.07] bg-ink/[0.03] px-3 py-2 text-[12.5px] font-semibold text-ink-75 transition-all duration-200 hover:bg-ink/[0.07] hover:text-ink active:scale-[0.98]"
        >
          <Globe size={15} className="shrink-0 text-accent" />
          <span className="flex-1 text-left">{t('together.open.title')}</span>
          {open.rooms && open.rooms.length > 0 && (
            <span className="rounded-full bg-accent/15 px-1.5 py-px text-[10.5px] tabular-nums text-accent">
              {open.rooms.length}
            </span>
          )}
          <ChevronRight size={14} className="shrink-0 text-ink-35" />
        </button>
      )}
    </div>
  );
}
