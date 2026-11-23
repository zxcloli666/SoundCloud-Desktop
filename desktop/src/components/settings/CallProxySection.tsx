import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type CallStatus, callIsEnabled, callSetEnabled, callStatus } from '../../lib/call';
import { Loader2, Lock, Power, Users } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { useStarSubscription } from '../layout/StarSubscription';
import { CallMesh } from './CallMesh';
import { Card } from './primitives';

const STATUS_POLL_MS = 5000;

const TONE: Record<CallStatus['kind'], string> = {
  active: 'rgb(var(--ok))',
  connecting: 'var(--color-amber-400)',
  provisioning: 'var(--color-amber-400)',
  failed: 'rgb(var(--bad))',
  disabled: 'rgb(var(--ink) / 0.4)',
};

export const CallProxySection: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const navigate = useNavigate();
  const { isPremium } = useStarSubscription();
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
      navigate('/star');
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

  const live = status.kind === 'active';
  const working = status.kind === 'connecting' || status.kind === 'provisioning';
  const locked = enabled && !isPremium;

  return (
    <Card
      title={t('call.title')}
      icon={<Users size={17} />}
      action={
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          aria-pressed={enabled}
          className="set-btn"
          data-tone={enabled ? undefined : 'accent'}
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" />
          ) : locked ? (
            <Lock size={13} />
          ) : (
            <Power size={13} />
          )}
          {enabled ? t('call.disable') : t('call.enable')}
        </button>
      }
    >
      <div
        className="relative h-[104px] overflow-hidden rounded-[12px] bg-[var(--set-well)] transition-colors duration-500"
        style={{ color: TONE[status.kind] }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `radial-gradient(50% 80% at 50% 45%, color-mix(in srgb, currentColor ${live ? 22 : 10}%, transparent), transparent 75%)`,
          }}
        />
        <CallMesh
          lit={live || working}
          animate={perf.idleAnim && (live || working)}
          glow={perf.glow}
        />
        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-2 rounded-full bg-[rgb(var(--surface)/0.88)] px-2.5 py-1 text-[12px] font-medium text-ink-80">
          <span
            className={`h-1.5 w-1.5 rounded-full bg-current ${perf.idleAnim && working ? 'animate-pulse' : ''}`}
            style={{ color: TONE[status.kind] }}
          />
          {t(`call.status.${status.kind}`)}
        </span>
      </div>
      {status.kind === 'failed' && status.error ? (
        <p className="break-all font-mono text-[11px] text-bad" title={status.error}>
          {status.error}
        </p>
      ) : null}
    </Card>
  );
});

CallProxySection.displayName = 'CallProxySection';
