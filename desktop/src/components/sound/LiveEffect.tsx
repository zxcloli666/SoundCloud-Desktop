import { memo, useMemo } from 'react';
import { useEffectsStore } from '../../stores/effects';
import { usePlayerStore } from '../../stores/player';
import { EffectCanvas } from '../music/effects/EffectCanvas';
import { QUIET, TEASER } from '../music/effects/presets';
import type { Scene } from '../music/effects/scene';
import { LockedBanner } from './LockedBanner';

export const LiveEffect = memo(function LiveEffect({ locked }: { locked: boolean }) {
  const enabled = useEffectsStore((s) => s.enabled);
  const reverb = useEffectsStore((s) => s.reverb);
  const room = useEffectsStore((s) => s.room);
  const eightD = useEffectsStore((s) => s.eightD);
  const eightDHz = useEffectsStore((s) => s.eightDHz);
  const bassDb = useEffectsStore((s) => s.bassDb);
  const rate = usePlayerStore((s) => s.playbackRate);

  const scene = useMemo<Scene>(() => {
    if (locked) return TEASER;
    return enabled ? { reverb, room, eightD, eightDHz, bassDb, rate } : QUIET;
  }, [locked, enabled, reverb, room, eightD, eightDHz, bassDb, rate]);

  return (
    <div
      data-ui="sound-live"
      className="relative min-h-0 flex-1 overflow-hidden rounded-[14px] border border-ink/[0.08] bg-ink/[0.025]"
    >
      <EffectCanvas scene={scene} className="absolute inset-0 size-full" />
      {locked && <LockedBanner />}
    </div>
  );
});
