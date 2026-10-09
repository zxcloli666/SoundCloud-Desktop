import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type CallStatus, callIsEnabled, callSetEnabled, callStatus } from '../../lib/call';
import { Loader2, Lock, Power, Users } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { useStarSubscription } from '../layout/StarSubscription';

const STATUS_POLL_MS = 5000;

const STATUS_COLOR: Record<CallStatus['kind'], string> = {
  active: '#34d399',
  connecting: '#fbbf24',
  provisioning: '#fbbf24',
  failed: '#ef4444',
  disabled: '#6b7280',
};

const CPS_KEYFRAMES = `
@keyframes cps-flow { to { stroke-dashoffset: -18; } }
@keyframes cps-node { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
@keyframes cps-halo { 0%,100% { opacity: .14; } 50% { opacity: .34; } }
`;

// Mesh geometry — full-bleed across the card. viewBox 360×120, "you" core upper-
// centre (the info row lives along the bottom), peers spread to every corner.
const CORE: [number, number] = [180, 46];
const PEERS: Array<[number, number]> = [
  [28, 26],
  [86, 92],
  [150, 20],
  [214, 96],
  [268, 30],
  [330, 84],
  [300, 108],
  [60, 104],
  [120, 60],
  [240, 58],
  [345, 40],
];
// extra peer↔peer links so it reads as a web, not just a star
const LINKS: Array<[number, number, number, number]> = [
  [28, 26, 60, 104],
  [268, 30, 330, 84],
  [214, 96, 300, 108],
  [150, 20, 268, 30],
  [120, 60, 240, 58],
];

/** "Сеть пользователей" — a live peer mesh stretched across the whole card.
 *  Dormant and dim when off; when the link comes up it lights to the status hue,
 *  packets flow along the edges and the nodes breathe. The info row sits over the
 *  mesh on a bottom scrim. All logic (status poll, premium gate) kept; the gate
 *  now routes to the dedicated STAR PASS page instead of a modal. */
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

  const net = STATUS_COLOR[status.kind];
  const live = status.kind === 'active';
  const working = status.kind === 'connecting' || status.kind === 'provisioning';
  const locked = enabled && !isPremium;
  const animate = perf.idleAnim && (live || working);
  const glow = perf.glow;
  const meshOpacity = live ? 1 : working ? 0.85 : status.kind === 'failed' ? 0.7 : 0.55;
  const blur = perf.blur(40);

  return (
    <section
      className="relative overflow-hidden rounded-3xl transition-[box-shadow,border-color] duration-500"
      style={{
        border: '0.5px solid rgba(255,255,255,0.1)',
        background:
          blur > 0
            ? 'linear-gradient(165deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015) 60%, rgba(255,255,255,0.03))'
            : 'rgba(18,18,22,0.85)',
        backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
        WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
        boxShadow: live
          ? `0 18px 50px rgba(0,0,0,0.42), 0 0 56px ${net}33, inset 0 1px 0 rgba(255,255,255,0.06)`
          : '0 18px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <style>{CPS_KEYFRAMES}</style>

      {/* ── full-bleed live mesh ── */}
      <div className="absolute inset-0" aria-hidden style={{ opacity: meshOpacity }}>
        <div
          className="absolute inset-0 transition-[background] duration-700"
          style={{
            background: `radial-gradient(55% 70% at 50% 38%, ${net}${live ? '2e' : '14'}, transparent 72%)`,
          }}
        />
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 360 120"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* spokes */}
          {PEERS.map(([x, y], i) => (
            <line
              key={`s${i}`}
              x1={CORE[0]}
              y1={CORE[1]}
              x2={x}
              y2={y}
              stroke={net}
              strokeWidth={1}
              strokeOpacity={0.3}
              strokeDasharray="3 7"
              style={
                animate
                  ? {
                      animation: `cps-flow ${(0.7 + (i % 3) * 0.25).toFixed(2)}s linear infinite`,
                    }
                  : undefined
              }
            />
          ))}
          {/* peer↔peer links */}
          {LINKS.map(([x1, y1, x2, y2], i) => (
            <line
              key={`l${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={net}
              strokeWidth={1}
              strokeOpacity={0.16}
              strokeDasharray="2 8"
              style={
                animate
                  ? { animation: `cps-flow ${(1 + i * 0.2).toFixed(2)}s linear infinite` }
                  : undefined
              }
            />
          ))}
          {/* peer nodes */}
          {PEERS.map(([x, y], i) => (
            <circle
              key={`n${i}`}
              cx={x}
              cy={y}
              r={2.6}
              fill={net}
              style={{
                opacity: live || working ? 0.9 : 0.5,
                filter: glow && (live || working) ? `drop-shadow(0 0 4px ${net})` : undefined,
                animation: animate
                  ? `cps-node ${(2.4 + (i % 4) * 0.5).toFixed(2)}s ease-in-out ${(i * 0.3).toFixed(2)}s infinite`
                  : undefined,
              }}
            />
          ))}
          {/* core "you" node */}
          <circle
            cx={CORE[0]}
            cy={CORE[1]}
            r={18}
            fill={net}
            style={{
              opacity: 0.18,
              filter: glow ? 'blur(2px)' : undefined,
              animation: animate ? 'cps-halo 2.6s ease-in-out infinite' : undefined,
            }}
          />
          <circle
            cx={CORE[0]}
            cy={CORE[1]}
            r={6}
            fill={net}
            style={{ filter: glow ? `drop-shadow(0 0 8px ${net})` : undefined }}
          />
          <circle cx={CORE[0]} cy={CORE[1]} r={2.4} fill="#fff" opacity={0.92} />
        </svg>
      </div>

      {/* readability scrim — keeps the bottom info row legible over the mesh */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,10,14,0) 34%, rgba(10,10,14,0.5) 72%, rgba(10,10,14,0.7) 100%)',
        }}
      />
      {/* top specular hairline */}
      <span
        aria-hidden
        className="absolute inset-x-6 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
        }}
      />

      {/* ── info + control (over the mesh) ── */}
      <div className="relative z-10 flex items-end gap-4 px-6 pb-6 pt-30">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-500"
          style={{
            color: net,
            background: `linear-gradient(135deg, ${net}26, rgba(255,255,255,0.04))`,
            border: `0.5px solid ${net}40`,
            boxShadow: live
              ? `0 0 18px ${net}40, inset 0 1px 0 rgba(255,255,255,0.18)`
              : 'inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
        >
          <Users size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-white/90 tracking-tight">{t('call.title')}</h3>
          <p className="flex items-center gap-2 text-[12px] text-white/50 mt-0.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: net,
                boxShadow: glow ? `0 0 8px ${net}` : undefined,
                animation: animate && working ? 'pulse 1.4s ease-in-out infinite' : undefined,
              }}
            />
            {t(`call.status.${status.kind}`)}
          </p>
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
          className="group relative inline-flex items-center gap-2.5 h-11 pl-3.5 pr-5 rounded-full text-[13px] font-bold shrink-0 transition-all duration-300 cursor-pointer hover:scale-[1.03] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
          style={
            enabled
              ? {
                  color: '#fff',
                  background: 'rgba(255,255,255,0.08)',
                  border: '0.5px solid rgba(255,255,255,0.16)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
                }
              : {
                  color: 'var(--color-accent-contrast)',
                  background:
                    'linear-gradient(180deg, var(--color-accent), var(--color-accent-hover))',
                  boxShadow:
                    '0 10px 28px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.25)',
                }
          }
        >
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300"
            style={
              enabled
                ? { background: `${net}2e`, color: net }
                : { background: 'rgba(255,255,255,0.92)', color: '#0a0a0c' }
            }
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : locked ? (
              <Lock size={12} />
            ) : (
              <Power size={13} strokeWidth={2.4} />
            )}
          </span>
          {enabled ? t('call.disable') : t('call.enable')}
        </button>
      </div>
    </section>
  );
});

CallProxySection.displayName = 'CallProxySection';
