import { EffectTiles } from './EffectTiles';
import { EqStrip } from './EqStrip';
import { LoopControl } from './LoopControl';
import { PitchControl, RateControl } from './Pace';
import { SleepControl } from './SleepControl';
import { SoundHead } from './SoundHead';

export type FullPanel = 'player-eq' | 'player-effects';

export function SoundConsole({ onFull }: { onFull: (panel: FullPanel) => void }) {
  return (
    <div className="sound-console flex flex-col gap-3.5 p-4">
      <SoundHead />
      <div className="sound-main grid gap-4">
        <EffectTiles onFull={() => onFull('player-effects')} />
        <EqStrip onFull={() => onFull('player-eq')} />
      </div>
      <div className="h-px bg-ink/[0.08]" />
      <div className="sound-foot grid gap-x-6 gap-y-3">
        <RateControl />
        <PitchControl />
        <SleepControl />
        <LoopControl />
      </div>
    </div>
  );
}
