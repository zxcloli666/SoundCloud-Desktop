import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {type FfmpegState, getTranscodeStatus, type TranscodeStatus} from '../../../lib/cache';
import {formatBytes} from '../../../lib/formatters';
import {AlertCircle, AudioLines, Disc3, Loader2, Sparkles} from '../../../lib/icons';
import {usePerfMode} from '../../../lib/perf';
import {Card} from '../primitives';

/** How often we poll the live pipeline snapshot while the card is visible. */
const POLL_MS = 5000;

/* Forge motion — transform/opacity only; idle motion gates on perf.idleAnim and
 * the global app-hidden pause. Scoped names so it can live in one injected block. */
const FORGE_KEYFRAMES = `
@keyframes forge-spin { to { transform: rotate(360deg); } }
@keyframes forge-spin-rev { to { transform: rotate(-360deg); } }
@keyframes forge-stream { from { transform: translateX(-50%); } to { transform: translateX(0); } }
@keyframes forge-breathe { 0%,100% { transform: scale(.9); opacity:.5 } 50% { transform: scale(1.1); opacity:.9 } }
@keyframes forge-emit { 0% { transform: scale(.72); opacity:.45 } 100% { transform: scale(1.9); opacity:0 } }
@keyframes forge-bob { 0%,100% { transform: scale(1) } 50% { transform: scale(1.05) } }
[data-app-hidden='1'] .forge-anim { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) { .forge-anim { animation: none !important; } }
`;

/** Per-state accent: the reactor + flow tint shifts with the engine's health. */
function stateColor(state: FfmpegState): { main: string; glow: string } {
    if (state === 'preparing') return {main: '#fbbf24', glow: 'rgba(251,191,36,0.30)'};
    if (state === 'unavailable')
        return {main: 'rgba(255,255,255,0.42)', glow: 'rgba(255,255,255,0.10)'};
    return {main: 'var(--color-accent)', glow: 'var(--color-accent-glow)'};
}

/* ── The flowing conduit between two stations ────────────────────────────── */
function Conduit({active, color}: { active: boolean; color: string }) {
    const perf = usePerfMode();
    const flow = active && perf.idleAnim;
    return (
        <div className="relative h-[2px] mx-1 self-center overflow-hidden rounded-full">
            {/* static rail */}
            <div
                className="absolute inset-0 rounded-full"
                style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
                }}
            />
            {/* travelling energy — a repeating tick pattern swept rightward (raw → clean) */}
            {flow && (
                <div
                    className="forge-anim absolute inset-y-0 left-0 w-[200%]"
                    style={{
                        background: `repeating-linear-gradient(90deg, transparent 0 13px, ${color} 13px 16px, transparent 16px 30px)`,
                        maskImage: 'linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)',
                        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)',
                        filter: perf.glow ? `drop-shadow(0 0 4px ${color})` : undefined,
                        animation: 'forge-stream 1.5s linear infinite',
                    }}
                />
            )}
        </div>
    );
}

/* ── A terminal node glyph (Raw / Vault), aligned on the rail ─────────────── */
function Glyph({
                   icon,
                   accent,
                   pulse,
               }: {
    icon: React.ReactNode;
    accent: boolean;
    pulse: boolean;
}) {
    const perf = usePerfMode();
    const bob = pulse && perf.idleAnim;
    return (
        <div
            className={`relative w-[60px] h-[60px] rounded-2xl flex items-center justify-center mx-auto ${
                bob ? 'forge-anim' : ''
            }`}
            style={{
                background: accent
                    ? 'linear-gradient(150deg, var(--color-accent-glow), rgba(255,255,255,0.03))'
                    : 'linear-gradient(150deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
                border: `0.5px solid ${accent ? 'var(--color-accent-glow)' : 'rgba(255,255,255,0.10)'}`,
                color: accent ? 'var(--color-accent)' : 'rgba(255,255,255,0.55)',
                boxShadow:
                    accent && perf.glow
                        ? '0 0 22px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.12)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.08)',
                animation: bob ? 'forge-bob 2.6s ease-in-out infinite' : undefined,
            }}
        >
            {icon}
        </div>
    );
}

/* ── The number + size beneath a node ────────────────────────────────────── */
function NodeMeta({
                      label,
                      value,
                      sub,
                      accent,
                  }: {
    label: string;
    value: string;
    sub: string;
    accent?: boolean;
}) {
    return (
        <div className="text-center leading-none">
            <div
                className="text-[10px] uppercase tracking-[0.16em] font-bold"
                style={{color: accent ? 'var(--color-accent)' : 'rgba(255,255,255,0.35)'}}
            >
                {label}
            </div>
            <div className="text-[20px] font-black text-white/90 tabular-nums mt-1.5">{value}</div>
            <div className="text-[10.5px] text-white/35 tabular-nums mt-1">{sub}</div>
        </div>
    );
}

/* ── The reactor core (ffmpeg engine) ────────────────────────────────────── */
function Core({state, transcoding}: { state: FfmpegState; transcoding: number }) {
    const perf = usePerfMode();
    const {main, glow} = stateColor(state);
    const active = state === 'ready' && transcoding > 0;
    const spin = perf.idleAnim && state !== 'unavailable';
    const blur = perf.blur(26);

    const center =
        state === 'preparing' ? (
            <Loader2 size={26} className="forge-anim animate-spin"/>
        ) : state === 'unavailable' ? (
            <AlertCircle size={26}/>
        ) : active ? (
            <Loader2 size={26} className="forge-anim animate-spin"/>
        ) : (
            <AudioLines size={26}/>
        );

    return (
        <div className="relative w-[104px] h-[104px] shrink-0 flex items-center justify-center">
            {/* ambient bloom */}
            <div
                aria-hidden
                className={spin ? 'forge-anim' : ''}
                style={{
                    position: 'absolute',
                    inset: '-14%',
                    borderRadius: '9999px',
                    background: `radial-gradient(circle, ${glow}, transparent 68%)`,
                    filter: blur ? `blur(${blur}px)` : undefined,
                    opacity: blur ? 1 : 0.55,
                    animation: spin ? 'forge-breathe 3.4s ease-in-out infinite' : undefined,
                }}
            />
            {/* emanating pulses while transcoding */}
            {active &&
                perf.idleAnim &&
                perf.glow &&
                [0, 1].map((i) => (
                    <div
                        key={i}
                        aria-hidden
                        className="forge-anim absolute rounded-full"
                        style={{
                            inset: '14%',
                            border: `1px solid ${main}`,
                            animation: `forge-emit 2.2s ease-out ${i * 1.1}s infinite`,
                        }}
                    />
                ))}
            {/* outer ring */}
            <div
                aria-hidden
                className={spin ? 'forge-anim' : ''}
                style={{
                    position: 'absolute',
                    inset: '6%',
                    borderRadius: '9999px',
                    border: '1.5px solid transparent',
                    background: `conic-gradient(from 0deg, transparent, ${main}, transparent 60%) border-box`,
                    WebkitMask: 'linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    opacity: state === 'unavailable' ? 0.4 : 0.95,
                    animation: spin ? `forge-spin ${active ? 3.5 : 9}s linear infinite` : undefined,
                }}
            />
            {/* inner ring (counter-rotating, dashed when unavailable) */}
            <div
                aria-hidden
                className={spin ? 'forge-anim' : ''}
                style={{
                    position: 'absolute',
                    inset: '20%',
                    borderRadius: '9999px',
                    border:
                        state === 'unavailable' ? '1px dashed rgba(255,255,255,0.28)' : `1px solid ${main}`,
                    opacity: state === 'unavailable' ? 0.5 : 0.35,
                    animation: spin ? `forge-spin-rev ${active ? 5 : 14}s linear infinite` : undefined,
                }}
            />
            {/* core disc */}
            <div
                className="relative w-[52px] h-[52px] rounded-full flex items-center justify-center"
                style={{
                    color: main,
                    background:
                        'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.10), rgba(8,8,12,0.85))',
                    border: `0.5px solid ${main}`,
                    boxShadow: perf.glow
                        ? `0 0 20px ${glow}, inset 0 0 12px ${glow}`
                        : `inset 0 0 10px ${glow}`,
                }}
            >
                {center}
            </div>
            {/* live count badge */}
            {active && (
                <div
                    className="absolute -top-0.5 -right-0.5 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-black tabular-nums text-accent-contrast"
                    style={{
                        background: 'var(--color-accent)',
                        boxShadow: '0 0 14px var(--color-accent-glow)',
                    }}
                >
                    {transcoding}
                </div>
            )}
        </div>
    );
}

export function SoundForgeCard() {
    const {t} = useTranslation();
    const [status, setStatus] = useState<TranscodeStatus | null>(null);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        let alive = true;
        const tick = async () => {
            try {
                const s = await getTranscodeStatus();
                if (alive) setStatus(s);
            } catch {
                /* settings just stays on the last snapshot */
            }
        };
        const start = () => {
            if (timerRef.current != null) return;
            void tick();
            timerRef.current = window.setInterval(tick, POLL_MS);
        };
        const stop = () => {
            if (timerRef.current == null) return;
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        };
        const onVis = () => (document.visibilityState === 'hidden' ? stop() : start());
        document.addEventListener('visibilitychange', onVis);
        if (document.visibilityState !== 'hidden') start();
        return () => {
            alive = false;
            stop();
            document.removeEventListener('visibilitychange', onVis);
        };
    }, []);

    const engine: FfmpegState = status?.ffmpeg ?? 'preparing';
    const incoming = status?.incoming ?? 0;
    const queued = status?.queued ?? 0;
    const transcoding = status?.transcoding ?? 0;
    const clean = status?.clean ?? 0;
    const active = engine === 'ready' && transcoding > 0;
    const {main} = stateColor(engine);

    const pillLabel =
        engine === 'ready'
            ? active
                ? t('forge.working')
                : t('forge.ready')
            : engine === 'preparing'
                ? t('forge.preparing')
                : t('forge.unavailable');

    const message =
        engine === 'preparing'
            ? t('forge.msgPreparing')
            : engine === 'unavailable'
                ? t('forge.msgUnavailable')
                : transcoding > 0 || queued > 0
                    ? t('forge.msgWorking', {active: transcoding, queued})
                    : t('forge.msgReady');

    const num = (n: number) => (status === null ? '·' : String(n));

    return (
        <Card
            title={t('forge.title')}
            desc={t('forge.desc')}
            icon={<Sparkles size={17}/>}
            action={
                <span
                    className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-bold tracking-wide"
                    style={{
                        color: main,
                        background: engine === 'ready' ? 'var(--color-accent-glow)' : 'rgba(255,255,255,0.05)',
                        border: `0.5px solid ${engine === 'ready' ? 'var(--color-accent-glow)' : 'rgba(255,255,255,0.10)'}`,
                    }}
                >
          <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                  background: main,
                  boxShadow: engine !== 'unavailable' ? `0 0 8px ${main}` : undefined,
              }}
          />
                    {pillLabel}
        </span>
            }
        >
            <style>{FORGE_KEYFRAMES}</style>

            {/* Rail: glyphs + conduits + core, all centered so the energy line runs
          glyph-to-glyph through the reactor. */}
            <div className="grid grid-cols-[68px_1fr_104px_1fr_68px] items-center pt-1">
                <Glyph icon={<AudioLines size={22}/>} accent={false} pulse={active}/>
                <Conduit active={active} color={main}/>
                <Core state={engine} transcoding={transcoding}/>
                <Conduit active={active} color="var(--color-accent)"/>
                <Glyph icon={<Disc3 size={22}/>} accent pulse={false}/>
            </div>

            {/* Meta row: number + size + label beneath each node. */}
            <div className="grid grid-cols-[68px_1fr_104px_1fr_68px] items-start mt-3">
                <NodeMeta
                    label={t('forge.raw')}
                    value={num(incoming)}
                    sub={incoming > 0 ? formatBytes(status?.incomingBytes ?? 0) : t('forge.empty')}
                />
                <span/>
                <div
                    className="text-center text-[10px] uppercase tracking-[0.16em] font-bold mt-1.5"
                    style={{color: engine === 'ready' ? 'var(--color-accent)' : main}}
                >
                    {t('forge.engine')}
                </div>
                <span/>
                <NodeMeta
                    label={t('forge.clean')}
                    value={num(clean)}
                    sub={formatBytes(status?.cleanBytes ?? 0)}
                    accent
                />
            </div>

            {/* plain-language status, so the picture is also understandable */}
            <div
                className="mt-5 flex items-start gap-2.5 rounded-2xl px-3.5 py-3"
                style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '0.5px solid rgba(255,255,255,0.06)',
                }}
            >
        <span className="mt-px shrink-0" style={{color: main}}>
          {engine === 'unavailable' ? (
              <AlertCircle size={14}/>
          ) : engine === 'preparing' ? (
              <Loader2 size={14} className="forge-anim animate-spin"/>
          ) : (
              <Sparkles size={14}/>
          )}
        </span>
                <p className="text-[12px] leading-relaxed text-white/55">{message}</p>
            </div>
        </Card>
    );
}
