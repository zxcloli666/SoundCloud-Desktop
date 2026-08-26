import React from 'react';
import {useTranslation} from 'react-i18next';
import type {TranscodeStatus} from '../../lib/cache';
import {usePerfMode} from '../../lib/perf';

const CHEVRONS = Array.from({ length: 16 }, (_, i) => i);

const Belt = React.memo(function Belt({ active, warm }: { active: boolean; warm: boolean }) {
  const perf = usePerfMode();
  const mask = 'linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)';
  return (
    <div
      className="relative mt-3 h-[10px] self-center overflow-hidden"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <div
        className="off-anim absolute left-[-42px] top-px flex gap-[14px]"
        style={{
          animation: active && perf.idleAnim ? 'off-belt 1.4s linear infinite' : undefined,
        }}
      >
        {CHEVRONS.map((i) => (
          <span
            key={i}
            className="h-[7px] w-[7px] flex-none rotate-45 border-r-[1.5px] border-t-[1.5px]"
            style={{
              borderColor: warm && active ? 'var(--color-accent-hover)' : 'rgba(255,255,255,0.30)',
              opacity: active ? 1 : 0.45,
            }}
          />
        ))}
      </div>
    </div>
  );
});

function Station({
  label,
  value,
  sub,
  hot,
}: {
  label: string;
  value: number;
  sub: string;
  hot?: boolean;
}) {
  const perf = usePerfMode();
  const burning = hot && value > 0;
  return (
    <div className="relative min-w-[84px]">
      {burning && perf.bloom && (
        <div
          className="off-anim pointer-events-none absolute -left-6 -top-2 h-24 w-[150px]"
          style={{
            background:
              'radial-gradient(ellipse at 40% 60%, var(--color-accent-glow), transparent 70%)',
            filter: `blur(${perf.blur(16)}px)`,
            animation: perf.idleAnim ? 'off-flicker 3.4s ease-in-out -1.1s infinite' : undefined,
          }}
        />
      )}
      {burning && perf.idleAnim && (
        <div className="pointer-events-none absolute -top-0.5 left-12 h-10 w-14">
          {[
            { left: '8%', dur: '2.1s', delay: '-0.2s', size: 3 },
            { left: '42%', dur: '2.7s', delay: '-1.3s', size: 2 },
            { left: '70%', dur: '2.4s', delay: '-1.9s', size: 3 },
            { left: '24%', dur: '3.1s', delay: '-0.8s', size: 2 },
          ]
            .slice(0, perf.particles(4))
            .map((s) => (
              <span
                key={s.left}
                className="off-anim absolute bottom-0 rounded-full"
                style={{
                  left: s.left,
                  width: s.size,
                  height: s.size,
                  background: 'var(--color-accent-hover)',
                  opacity: 0,
                  animation: `off-spark ${s.dur} ease-out ${s.delay} infinite`,
                }}
              />
            ))}
        </div>
      )}
      <div className="relative">
        <div className="mb-2.5 whitespace-nowrap font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/35">
          {label}
        </div>
        <div
          className="font-mono text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums md:text-[44px]"
          style={
            burning
              ? {
                  color: 'var(--color-accent-hover)',
                  textShadow: perf.glow
                    ? '0 0 26px var(--color-accent-glow), 0 0 64px var(--color-accent-glow)'
                    : undefined,
                }
              : { color: 'rgba(255,255,255,0.92)' }
          }
        >
          {value}
        </div>
        <div className="mt-2 whitespace-nowrap text-[11px] leading-tight text-white/45">{sub}</div>
      </div>
    </div>
  );
}

/** Левый модуль hero: живой конвейер А → Б (сырьё → горн → чистые m4a). */
export const ForgeModule = React.memo(function ForgeModule({
  status,
  forgingTitle,
}: {
  status: TranscodeStatus | null;
  forgingTitle: string | null;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const incoming = status?.incoming ?? 0;
  const queued = status?.queued ?? 0;
  const transcoding = status?.transcoding ?? 0;
  const clean = status?.clean ?? 0;
  const ffmpeg = status?.ffmpeg ?? 'preparing';

  const chip = {
    ready: { cls: 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200/90', pulse: false },
    preparing: { cls: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200/90', pulse: true },
    unavailable: { cls: 'border-rose-400/30 bg-rose-400/[0.08] text-rose-200/90', pulse: false },
  }[ffmpeg];

  const log =
    transcoding > 0 && forgingTitle
      ? t('offline.forgeLogActive', { title: forgingTitle })
      : queued > 0 && ffmpeg !== 'ready'
        ? t('offline.forgeLogWaiting')
        : queued > 0
          ? t('offline.forgeLogQueued', { count: queued })
          : t('offline.forgeLogIdle');

  return (
    <div className="flex min-w-0 flex-col px-5 py-5 md:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
          {t('offline.forgeTitle')}
          <b className="font-semibold normal-case tracking-[0.08em] text-white/55">
            · {t('offline.forgeSub')}
          </b>
        </span>
        <span
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-[5px] font-mono text-[10.5px] font-medium tracking-[0.06em] ${chip.cls}`}
        >
          <span
            className="off-anim size-[5px] rounded-full bg-current"
            style={{
              animation:
                chip.pulse && perf.idleAnim ? 'off-pulse 2.2s ease-in-out infinite' : undefined,
            }}
          />
          {t(`offline.ffmpeg_${ffmpeg}`)}
        </span>
      </div>

      <div className="grid flex-1 content-center grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-4">
        <Station label={t('offline.stRaw')} value={incoming} sub={t('offline.stRawSub')} />
        <Belt active={queued > 0 && ffmpeg === 'ready'} warm={false} />
        <Station
          label={t('offline.stForge')}
          value={transcoding}
          sub={transcoding > 0 ? t('offline.stForgeSubActive') : t('offline.stForgeSubIdle')}
          hot
        />
        <Belt active={transcoding > 0} warm />
        <Station label={t('offline.stClean')} value={clean} sub={t('offline.stCleanSub')} />
      </div>

      <div className="mt-4 flex items-center gap-2 overflow-hidden border-t border-white/[0.06] pt-3 font-mono text-[11px] text-white/45">
        <span style={{ color: 'var(--color-accent)' }}>›</span>
        <span className="truncate">{log}</span>
        {transcoding > 0 && (
          <span
            className="off-anim h-[11px] w-[6px] flex-none"
            style={{
              background: 'var(--color-accent-glow)',
              animation: perf.idleAnim ? 'off-pulse 1.1s steps(2) infinite' : undefined,
            }}
          />
        )}
      </div>
    </div>
  );
});
