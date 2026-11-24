import { useSoundWindow } from '../../stores/sound-window';
import { EffectsSection } from './EffectsSection';
import { EqSection } from './EqSection';
import { LoopControl } from './LoopControl';
import { PitchControl, RateControl } from './Pace';
import { SleepControl } from './SleepControl';
import { SoundHead } from './SoundHead';

export function SoundConsole() {
  const section = useSoundWindow((s) => s.section);
  return (
    <div className="sound-console flex flex-col gap-3.5 p-4">
      <SoundHead />
      <div data-ui="sound-view" data-view={section} className="sound-main grid gap-4">
        {section !== 'eq' && <EffectsSection full={section === 'effects'} />}
        {section !== 'effects' && <EqSection full={section === 'eq'} />}
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
