import {listen} from '@tauri-apps/api/event';
import React, {useEffect, useRef} from 'react';
import {trackedInvoke as invoke} from '../../../lib/diagnostics';

let analyserConsumers = 0;
let analyserDisableTimer: ReturnType<typeof setTimeout> | null = null;

function retainAnalyser(): () => void {
    const disableWasPending = analyserDisableTimer !== null;
    if (analyserDisableTimer) {
        clearTimeout(analyserDisableTimer);
        analyserDisableTimer = null;
    }
    if (analyserConsumers === 0 && !disableWasPending) {
        void invoke('audio_set_analyser_enabled', {enabled: true});
    }
    analyserConsumers += 1;

    let released = false;
    return () => {
        if (released) return;
        released = true;
        analyserConsumers = Math.max(0, analyserConsumers - 1);
        if (analyserConsumers > 0 || analyserDisableTimer) return;
        // Coalesce React StrictMode's setup -> cleanup -> setup cycle and keep
        // one visualizer from disabling FFT while another instance still uses it.
        analyserDisableTimer = setTimeout(() => {
            analyserDisableTimer = null;
            if (analyserConsumers === 0) {
                void invoke('audio_set_analyser_enabled', {enabled: false});
            }
        }, 0);
    };
}

/* ── Fullscreen wave visualizer — driven by real FFT from Rust ────── */
/* Rust `audio:fft` event delivers 64 log-spaced magnitude bins ~30Hz.
 * We never poll: the canvas redraws ONLY when a new frame arrives + a short
 * decay tail (~250ms) so play→pause fades smoothly. No rAF when idle. */

const VIS_BINS = 64;

function readAccentRgb(): [number, number, number] {
    if (typeof window === 'undefined') return [255, 85, 0];
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
    if (raw.startsWith('#')) {
        const hex = raw.slice(1);
        const v =
            hex.length === 3
                ? hex
                    .split('')
                    .map((c) => c + c)
                    .join('')
                : hex;
        return [
            Number.parseInt(v.slice(0, 2), 16),
            Number.parseInt(v.slice(2, 4), 16),
            Number.parseInt(v.slice(4, 6), 16),
        ];
    }
    const m = raw.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    return [255, 85, 0];
}

export const LyricsVisualizer = React.memo(() => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    // Mirror of the latest FFT bins. Smoothed display values live separately
    // so we can do a quick decay tail after the last event.
    const targetRef = useRef<Float32Array>(new Float32Array(VIS_BINS));
    const displayRef = useRef<Float32Array>(new Float32Array(VIS_BINS));

    useEffect(() => {
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas || !wrap) return;

        const ctx = canvas.getContext('2d', {alpha: true});
        if (!ctx) return;

        const accent = readAccentRgb();
        let dpr = Math.min(window.devicePixelRatio || 1, 2);
        let cssW = 0;
        let cssH = 0;

        const resize = () => {
            const r = wrap.getBoundingClientRect();
            cssW = Math.max(1, Math.floor(r.width));
            cssH = Math.max(1, Math.floor(r.height));
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(cssW * dpr);
            canvas.height = Math.floor(cssH * dpr);
            canvas.style.width = `${cssW}px`;
            canvas.style.height = `${cssH}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(wrap);

        // Reusable smoothed-bins buffer; refilled per-frame to avoid GC churn.
        const smoothedBins = new Float32Array(VIS_BINS);
        // X-coords for each bin, evenly spread across the full viewport width.
        let sampleXs: Float32Array | null = null;
        const buildSampleXs = () => {
            const xs = new Float32Array(VIS_BINS);
            for (let i = 0; i < VIS_BINS; i++) xs[i] = (i / (VIS_BINS - 1)) * cssW;
            sampleXs = xs;
        };

        const draw = () => {
            if (document.visibilityState === 'hidden') return;
            ctx.clearRect(0, 0, cssW, cssH);
            if (!sampleXs || sampleXs.length !== VIS_BINS) buildSampleXs();

            const display = displayRef.current;

            // Smooth bins horizontally to kill staircase between adjacent bins.
            // 1-2-1 kernel; result is rounder, no "sharp jump bass→treble" artifact.
            smoothedBins[0] = (display[0] * 3 + display[1]) * 0.25;
            smoothedBins[VIS_BINS - 1] = (display[VIS_BINS - 1] * 3 + display[VIS_BINS - 2]) * 0.25;
            for (let i = 1; i < VIS_BINS - 1; i++) {
                smoothedBins[i] = display[i - 1] * 0.25 + display[i] * 0.5 + display[i + 1] * 0.25;
            }

            // Wave sits at the very bottom; amplitude grows upward.
            const baseY = cssH - 6;
            const maxAmp = cssH * 0.78;
            const xs = sampleXs;
            if (!xs) return;

            let peak = 0;
            for (let i = 0; i < VIS_BINS; i++) if (display[i] > peak) peak = display[i];

            // Smooth path: quadratic Béziers through midpoints between consecutive bins.
            // Bins go left → right across the full width: bin[0]=lows on the left,
            // bin[VIS_BINS-1]=highs on the right. No mirroring.
            const tracePath = (ampScale: number) => {
                ctx.beginPath();
                const y0 = baseY - smoothedBins[0] * maxAmp * ampScale;
                ctx.moveTo(xs[0], y0);
                for (let i = 0; i < VIS_BINS - 1; i++) {
                    const yA = baseY - smoothedBins[i] * maxAmp * ampScale;
                    const yB = baseY - smoothedBins[i + 1] * maxAmp * ampScale;
                    const xA = xs[i];
                    const xB = xs[i + 1];
                    const xMid = (xA + xB) * 0.5;
                    const yMid = (yA + yB) * 0.5;
                    ctx.quadraticCurveTo(xA, yA, xMid, yMid);
                }
                // Final anchor at the rightmost bin
                ctx.lineTo(xs[VIS_BINS - 1], baseY - smoothedBins[VIS_BINS - 1] * maxAmp * ampScale);
            };

            // Filled body with vertical accent gradient.
            const fillGrad = ctx.createLinearGradient(0, 0, 0, cssH);
            fillGrad.addColorStop(0, `rgba(${accent[0]}, ${accent[1]}, ${accent[2]}, 0)`);
            fillGrad.addColorStop(
                0.5,
                `rgba(${accent[0]}, ${accent[1]}, ${accent[2]}, ${(0.18 * Math.min(1, peak * 1.3)).toFixed(3)})`,
            );
            fillGrad.addColorStop(
                1,
                `rgba(${accent[0]}, ${accent[1]}, ${accent[2]}, ${(0.32 * Math.min(1, peak * 1.3)).toFixed(3)})`,
            );

            tracePath(1.0);
            ctx.lineTo(cssW, baseY);
            ctx.lineTo(0, baseY);
            ctx.closePath();
            ctx.fillStyle = fillGrad;
            ctx.fill();

            // Strokes — 3 layered for depth.
            const drawStroke = (
                ampScale: number,
                alphaMul: number,
                hueAccent: boolean,
                lineW: number,
            ) => {
                tracePath(ampScale);
                const [rC, gC, bC] = hueAccent ? accent : [255, 255, 255];
                const peakAlpha = (0.45 + 0.4 * Math.min(1, peak)) * alphaMul;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.lineWidth = lineW;
                ctx.strokeStyle = `rgba(${rC}, ${gC}, ${bC}, ${peakAlpha.toFixed(3)})`;
                ctx.shadowBlur = 24 * alphaMul;
                ctx.shadowColor = `rgba(${rC}, ${gC}, ${bC}, ${(peakAlpha * 0.6).toFixed(3)})`;
                ctx.stroke();
            };

            drawStroke(1.0, 1.0, true, 2.4);
            drawStroke(0.78, 0.5, false, 1.2);
            ctx.shadowBlur = 0;
        };

        let rafId = 0;
        let lastEventTs = 0;
        let lastDecayTs = performance.now();

        // Single rAF that runs only when there is something to animate:
        // either a new frame is available, or we are still decaying after pause.
        let dirty = false;
        const ensureLoop = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(loop);
        };
        const loop = (ts: number) => {
            const dt = Math.min(0.05, (ts - lastDecayTs) / 1000);
            lastDecayTs = ts;

            // Smooth target → display. Faster attack, slower release.
            const target = targetRef.current;
            const display = displayRef.current;
            const attack = 1 - Math.exp(-dt * 18); // ~55ms
            const release = 1 - Math.exp(-dt * 5); // ~200ms
            let any = false;
            for (let i = 0; i < VIS_BINS; i++) {
                const t = target[i];
                const d = display[i];
                const k = t > d ? attack : release;
                const next = d + (t - d) * k;
                display[i] = next;
                if (next > 1e-3 || t > 1e-3) any = true;
            }

            draw();

            const sinceEvent = ts - lastEventTs;
            // Keep ticking while there's energy on screen, or up to 350ms after the
            // last event (lets us animate the post-event smoothing curve). Otherwise
            // park the rAF — pure idle CPU.
            if (any && (dirty || sinceEvent < 350)) {
                rafId = requestAnimationFrame(loop);
            } else {
                rafId = 0;
                dirty = false;
            }
        };

        const unlistenPromise = listen<number[]>('audio:fft', (event) => {
            const bins = event.payload;
            if (!bins || bins.length === 0) return;
            const target = targetRef.current;
            const n = Math.min(target.length, bins.length);
            for (let i = 0; i < n; i++) target[i] = bins[i];
            lastEventTs = performance.now();
            dirty = true;
            ensureLoop();
        });
        const releaseAnalyser = retainAnalyser();

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            ro.disconnect();
            unlistenPromise.then((u) => u());
            releaseAnalyser();
        };
    }, []);

    return (
        <div
            ref={wrapRef}
            className="absolute inset-x-0 bottom-0 z-0 pointer-events-none"
            style={{
                height: 'clamp(320px, 62vh, 100vh)',
                // Hard floor at bottom (full opacity until ~78% from the top of the canvas)
                // and a soft fade upward — so the wave reads as rooted to the very edge.
                maskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)',
                contain: 'strict',
                transform: 'translateZ(0)',
            }}
        >
            <canvas ref={canvasRef} className="block"/>
        </div>
    );
});
