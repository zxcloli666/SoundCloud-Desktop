import { memo, useEffect, useRef } from 'react';
import { isAppIdle, subscribeAppIdle, usePerfMode } from '../../lib/perf';
import { useSettingsStore } from '../../stores/settings';

/** Vertical position of the core within its region (the dark "well" centre). */
export const CORE_CENTER_Y = 0.46;

interface LivingCoreProps {
  /** Plan brightness 0..1 — drives spectrum gain + bloom. */
  charge: number;
  /** Spin faster + pulse while awaiting payment. */
  waiting: boolean;
  /** Brighter steady core once the membership is active. */
  lit: boolean;
  /** Increment to fire an ignite flash + shockwave. */
  igniteKey: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  const v =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = Number.parseInt(v.slice(0, 6) || 'ff5500', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The "living core" — a sound-reactive aperture rendered on canvas. Energy lives
 * in a spectrum ring + glowing rim; the centre is a dark well kept readable for
 * overlaid content (price / identity / status). Warm core (user accent) against a
 * fixed cool-violet fringe for depth. Animation is perf-gated: light mode draws a
 * single static frame, and the rAF loop pauses while the window is hidden or unfocused
 * (WebView never throttles timers — see CLAUDE.md).
 */
export const LivingCore = memo(function LivingCore({
  charge,
  waiting,
  lit,
  igniteKey,
}: LivingCoreProps) {
  const perf = usePerfMode();
  const accent = useSettingsStore((s) => s.accentColor);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Live params read by the rAF loop (no React re-render on the hot path).
  const p = useRef({
    charge,
    waiting,
    lit,
    chargeEased: charge,
    core: 1,
    coreTarget: 1,
    shock: -1,
  });
  p.current.charge = charge;
  p.current.waiting = waiting;
  p.current.lit = lit;
  p.current.coreTarget = lit ? 1.18 : waiting ? 0.92 : 1;

  // Ignite → kick a shockwave.
  const prevIgnite = useRef(igniteKey);
  if (igniteKey !== prevIgnite.current) {
    prevIgnite.current = igniteKey;
    p.current.shock = 0;
  }

  const animate = perf.idleAnim;
  const useGlow = perf.glow;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const [ar, ag, ab] = hexToRgb(accent);
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const N = 130;
    const phase = Array.from({ length: N }, () => Math.random() * 6.283);
    const sparks: { a: number; r: number; life: number; sp: number }[] = [];
    let W = 0;
    let H = 0;
    let t = 0;
    let raf = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (!raf) draw(true);
    };

    function draw(staticFrame = false) {
      if (!ctx) return;
      const s = p.current;
      s.chargeEased += (s.charge - s.chargeEased) * (staticFrame ? 1 : 0.07);
      s.core += (s.coreTarget - s.core) * (staticFrame ? 1 : 0.06);
      const ch = s.chargeEased;
      const cx = W / 2;
      const cy = H * CORE_CENTER_Y;
      // Longer plan → bigger, livelier constellation (size scales with charge,
      // not just brightness); eased via chargeEased so it grows/shrinks smoothly.
      const scale = 0.78 + ch * 0.34;
      const innerR = Math.min(W, H) * 0.135 * scale;
      const bass = staticFrame ? 0.6 : 0.5 + 0.5 * Math.sin(t * 2.1) + 0.2 * Math.sin(t * 3.6);
      const gain = (0.4 + ch * 0.6) * s.core;
      const blur = useGlow ? 9 : 0;

      ctx.clearRect(0, 0, W, H);

      // bloom: warm accent core → cool violet fringe
      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.52);
      const a = 0.09 + ch * 0.13;
      g.addColorStop(0, `rgba(${ar},${ag},${ab},${a})`);
      g.addColorStop(0.45, `rgba(${ar},${ag},${ab},${a * 0.5})`);
      g.addColorStop(0.8, `rgba(125,108,255,${a * 0.22})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // spectrum ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * (s.waiting ? 0.16 : 0.04 + ch * 0.05));
      ctx.lineCap = 'round';
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * 6.283;
        let v = Math.abs(
          Math.sin(t * 1.4 + phase[i]) * 0.5 +
            Math.sin(t * 2.6 + phase[i] * 1.6) * 0.32 +
            Math.sin(t * 0.8 + ang * 3) * 0.4,
        );
        v = v * (0.5 + 0.5 * bass) * gain;
        const len = innerR * 0.2 + v * innerR * 1.3;
        const c1 = Math.cos(ang);
        const s1 = Math.sin(ang);
        const tip = Math.min(1, v * 1.3);
        // warm near the core → cool at the tips
        const rr = ar;
        const gg = Math.max(80, Math.round(ag - 60 * tip));
        const bb = Math.min(255, Math.round(ab + 210 * tip));
        ctx.strokeStyle = `rgba(${rr},${gg},${bb},${0.5 + v * 0.5})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = blur;
        ctx.shadowColor = `rgba(${ar},${ag},${ab},0.7)`;
        ctx.beginPath();
        ctx.moveTo(c1 * innerR, s1 * innerR);
        ctx.lineTo(c1 * (innerR + len), s1 * (innerR + len));
        ctx.stroke();
      }
      ctx.restore();
      ctx.shadowBlur = 0;

      // glowing aperture rim (warm full ring + cool arc accent)
      ctx.strokeStyle = `rgba(${Math.min(255, ar + 40)},${Math.min(255, ag + 90)},${Math.min(255, ab + 90)},${0.5 + ch * 0.4})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = useGlow ? 20 : 0;
      ctx.shadowColor = `rgba(${ar},${ag},${ab},0.9)`;
      ctx.beginPath();
      ctx.arc(cx, cy, innerR * 0.98, 0, 7);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(180,170,255,0.45)';
      ctx.lineWidth = 1.4;
      ctx.shadowColor = 'rgba(125,108,255,0.8)';
      ctx.beginPath();
      ctx.arc(cx, cy, innerR * 0.98, Math.PI * 1.02, Math.PI * 1.7);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // fine aperture ticks
      for (let i = 0; i < 48; i++) {
        const ang = (i / 48) * 6.283;
        const r0 = innerR * 0.86;
        const r1 = innerR * 0.92;
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
        ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
        ctx.stroke();
      }

      // dark well — soft aperture vignette (long feather, no hard disc edge so it
      // composes under the readout's lens instead of stacking a second dark ring)
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR * 0.98);
      g.addColorStop(0, 'rgba(6,6,10,0.94)');
      g.addColorStop(0.5, 'rgba(6,6,10,0.78)');
      g.addColorStop(0.82, 'rgba(6,6,10,0.32)');
      g.addColorStop(1, 'rgba(6,6,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, innerR * 0.98, 0, 7);
      ctx.fill();

      if (!staticFrame) {
        // embers — denser the more charged the core is
        if (Math.random() < 0.22 + ch * 0.3)
          sparks.push({
            a: Math.random() * 6.283,
            r: innerR * 1.1,
            life: 1,
            sp: 0.5 + Math.random() * 0.9,
          });
        for (let i = sparks.length - 1; i >= 0; i--) {
          const sp = sparks[i];
          sp.r += sp.sp;
          sp.life -= 0.012;
          if (sp.life <= 0) {
            sparks.splice(i, 1);
            continue;
          }
          const x = cx + Math.cos(sp.a) * sp.r;
          const y = cy + Math.sin(sp.a) * sp.r - (1 - sp.life) * 12;
          ctx.fillStyle = `rgba(255,${180 + Math.round(sp.life * 55)},120,${sp.life * 0.7})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, 7);
          ctx.fill();
        }
      }

      // shockwave on ignite
      if (s.shock >= 0) {
        s.shock += 0.02;
        const sr = s.shock * Math.min(W, H) * 0.75;
        ctx.strokeStyle = `rgba(${Math.min(255, ar + 40)},${Math.min(255, ag + 80)},90,${Math.max(0, 0.7 - s.shock)})`;
        ctx.lineWidth = 3 * (1 - s.shock);
        ctx.beginPath();
        ctx.arc(cx, cy, sr, 0, 7);
        ctx.stroke();
        if (s.shock >= 1) s.shock = -1;
      }
    }

    const loop = () => {
      t += 0.016;
      draw(false);
      raf = requestAnimationFrame(loop);
    };

    const onIdleChange = () => {
      if (isAppIdle()) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = requestAnimationFrame(loop);
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let unsubscribeIdle: (() => void) | undefined;
    if (animate) {
      onIdleChange();
      unsubscribeIdle = subscribeAppIdle(onIdleChange);
    }

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      unsubscribeIdle?.();
    };
  }, [accent, animate, useGlow]);

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />;
});
