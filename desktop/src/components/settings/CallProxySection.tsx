import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type CallStatus, callIsEnabled, callSetEnabled, callStatus } from '../../lib/call';
import { Lock } from '../../lib/icons';
import { StarModal, useStarSubscription } from '../layout/StarSubscription';

const STATUS_POLL_MS = 5000;

const DOT_COLOR: Record<CallStatus['kind'], string> = {
  active: '#34d399',
  connecting: '#fbbf24',
  provisioning: '#fbbf24',
  failed: '#ef4444',
  disabled: '#52525b',
};

export const CallProxySection: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const { isPremium, modalOpen, setModalOpen, openModal } = useStarSubscription();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<CallStatus>({ kind: 'disabled' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    callIsEnabled()
      .then((v) => {
        setEnabled(v);
        callStatus()
          .then(setStatus)
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      callStatus()
        .then(setStatus)
        .catch(() => {});
    }, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [enabled]);

  const onToggle = async () => {
    if (busy || enabled === null) return;
    if (enabled && !isPremium) {
      openModal();
      return;
    }
    setBusy(true);
    try {
      const next = !enabled;
      const s = await callSetEnabled(next);
      setEnabled(next);
      setStatus(s);
    } finally {
      setBusy(false);
    }
  };

  if (enabled === null) return null;

  const dot = DOT_COLOR[status.kind];
  const locked = enabled && !isPremium;

  return (
    <>
      <section
        className="liquid-panel relative overflow-hidden rounded-[30px]"
        style={{ contain: 'layout paint style' }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 80% 0%, var(--color-accent-glow) 0%, transparent 60%), linear-gradient(165deg, rgba(20,20,28,0.55) 0%, rgba(10,10,14,0.65) 100%)',
            contain: 'strict',
            transform: 'translateZ(0)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 50%, transparent 100%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 rounded-[30px] pointer-events-none"
          style={{ border: '0.5px solid rgba(255,255,255,0.08)' }}
        />

        <div
          className="relative flex items-center gap-4 px-5 py-4"
          style={{ isolation: 'isolate' }}
        >
          <div
            className="relative shrink-0 rounded-full"
            style={{
              width: 10,
              height: 10,
              background: dot,
              boxShadow: `0 0 14px ${dot}`,
              animation:
                status.kind === 'connecting' || status.kind === 'provisioning'
                  ? 'pulse 1.4s ease-in-out infinite'
                  : undefined,
            }}
          />

          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-white">
              {t('call.title')}
            </h3>
            <p className="text-[11px] text-white/45 mt-0.5">{t(`call.status.${status.kind}`)}</p>
            {status.kind === 'failed' && status.error ? (
              <p
                className="text-[10px] text-red-400/80 mt-1 font-mono break-all"
                title={status.error}
              >
                {status.error}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            aria-pressed={enabled}
            aria-label={enabled ? t('call.disable') : t('call.enable')}
            className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 active:scale-[0.94] disabled:opacity-50"
            style={{
              background: enabled ? 'var(--color-accent)' : 'rgba(255,255,255,0.2)',
            }}
          >
            <span
              className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full shadow-md transition-transform duration-200"
              style={{
                background: '#ffffff',
                transform: enabled ? 'translateX(22px)' : 'translateX(2px)',
              }}
            >
              {locked ? <Lock size={10} className="text-black/60" /> : null}
            </span>
          </button>
        </div>
      </section>

      <StarModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
});

CallProxySection.displayName = 'CallProxySection';
