import { listen } from '@tauri-apps/api/event';
import { createSpectrumClaim } from '../../../../lib/spectrum';
import { type AmbientMatter, type SceneReaction, stillReaction } from './ambient-matter';

const FRAME_MS = 31;
const MAX_STEP_MS = 100;
const BLEND_MS = 420;
const ACCENT_GAP_MS = 78;
const SPEEDS_UP = [52, 24, 22, 52];
const SPEEDS_DOWN = [128, 88, 74, 128];

export type SceneClock = { phase: number };

export function startSceneLoop(renderer: () => AmbientMatter | null, clock: SceneClock) {
  let live = true;
  let frame = 0;
  let last = 0;
  let blend = 0;
  let lastBass = 0;
  let contourKick = 0;
  let contourExposure = 0;
  let lastAccent = Number.NEGATIVE_INFINITY;
  let available = false;
  let target = [0, 0, 0, 0];
  const lead = [0, 0, 0, 0];
  const values = [0, 0, 0, 0];
  const reaction: SceneReaction = { ...stillReaction };
  const claim = createSpectrumClaim();

  const follow = (elapsed: number) => {
    for (let i = 0; i < 4; i++) {
      const next = target[i];
      const speed = next > lead[i] ? SPEEDS_UP[i] : SPEEDS_DOWN[i];
      const factor = Math.exp(-elapsed / speed);
      const difference = lead[i] - next;
      lead[i] = next + difference * factor;
      values[i] = next + (values[i] - next + (difference * elapsed) / speed) * factor;
    }
    [reaction.energy, reaction.bass, reaction.pulse, reaction.flux] = values;
    reaction.available = available;
  };

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const elapsed = last ? now - last : 34;
    if (elapsed < FRAME_MS) return;
    last = now;
    const dt = Math.min(elapsed, MAX_STEP_MS);
    blend += (1 - blend) * (1 - Math.exp(-dt / BLEND_MS));
    clock.phase += (dt / 1000) * (0.72 + blend * 0.28);
    follow(dt);
    const attack = Math.exp(-dt / 26);
    const decay = Math.exp(-dt / 115);
    contourExposure = contourExposure * attack + (contourKick * (decay - attack) * 115) / 89;
    contourKick *= decay;
    renderer()?.draw(clock.phase, reaction, blend, 1 + contourExposure);
  };

  const release = listen<number[]>('audio:fft', ({ payload }) => {
    if (!live || !payload?.length) return;
    available = true;
    const bassBins = Math.min(8, payload.length);
    let bass = 0;
    let energy = 0;
    for (let i = 0; i < payload.length; i++) {
      energy += payload[i] || 0;
      if (i < bassBins) bass += payload[i] || 0;
    }
    bass = Math.min(1, (bass * 3.7) / bassBins);
    const pulse = Math.min(1, Math.max(0, bass - lastBass) * 3.8);
    const now = performance.now();
    if (bass >= 0.18 && pulse >= 0.06 && now - lastAccent >= ACCENT_GAP_MS) {
      contourKick = Math.min(1, contourKick + 0.28 + pulse * 0.62);
      lastAccent = now;
    }
    lastBass = bass;
    target = [Math.min(1, (energy * 2) / payload.length), bass, pulse, pulse];
  });

  frame = requestAnimationFrame(tick);
  void release.then(
    () => {
      if (live) claim(true);
    },
    () => {},
  );

  return () => {
    live = false;
    cancelAnimationFrame(frame);
    claim(false);
    void release.then(
      (off) => off(),
      () => {},
    );
    renderer()?.draw(clock.phase, stillReaction, 0);
  };
}
