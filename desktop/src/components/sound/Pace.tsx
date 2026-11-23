import { useTranslation } from 'react-i18next';
import { Gauge, Music } from '../../lib/icons';
import { formatPitch, formatRate } from '../../lib/sound/live';
import {
  getEffectivePitchSemitones,
  PITCH_SEMITONES_MAX,
  PITCH_SEMITONES_MIN,
  PITCH_SEMITONES_STEP,
  PLAYBACK_RATE_MAX,
  PLAYBACK_RATE_MIN,
  PLAYBACK_RATE_STEP,
  usePlayerStore,
} from '../../stores/player';
import { PaceSlider } from './PaceSlider';

const NEAR = 0.001;

export function RateControl() {
  const { t } = useTranslation();
  const rate = usePlayerStore((s) => s.playbackRate);
  const setRate = usePlayerStore((s) => s.setPlaybackRate);
  const reset = usePlayerStore((s) => s.resetPlaybackRate);
  return (
    <PaceSlider
      marker="sound-rate"
      icon={<Gauge size={13} />}
      label={t('player.playbackSpeed')}
      readout={formatRate(rate)}
      changed={Math.abs(rate - 1) >= NEAR}
      resetLabel={t('player.playbackSpeedReset')}
      onReset={reset}
      value={rate}
      rest={1}
      min={PLAYBACK_RATE_MIN}
      max={PLAYBACK_RATE_MAX}
      step={PLAYBACK_RATE_STEP}
      onChange={setRate}
    />
  );
}

export function PitchControl() {
  const { t } = useTranslation();
  const rate = usePlayerStore((s) => s.playbackRate);
  const manual = usePlayerStore((s) => s.pitchSemitones);
  const mode = usePlayerStore((s) => s.pitchControlMode);
  const setMode = usePlayerStore((s) => s.setPitchControlMode);
  const setPitch = usePlayerStore((s) => s.setPitchSemitones);
  const auto = mode === 'auto';
  const pitch = getEffectivePitchSemitones(rate, mode, manual);
  const change = (next: number) => {
    if (auto) setMode('manual');
    setPitch(next);
  };
  return (
    <PaceSlider
      marker="sound-pitch"
      icon={<Music size={13} />}
      label={t('player.pitch')}
      readout={formatPitch(pitch)}
      changed={!auto && Math.abs(manual) >= NEAR}
      resetLabel={t('player.pitchReset')}
      onReset={() => setPitch(0)}
      value={pitch}
      rest={0}
      min={PITCH_SEMITONES_MIN}
      max={PITCH_SEMITONES_MAX}
      step={PITCH_SEMITONES_STEP}
      onChange={change}
    >
      <button
        type="button"
        aria-pressed={auto}
        title={t('player.pitchModeAuto')}
        onClick={() => setMode(auto ? 'manual' : 'auto')}
        className={`h-[18px] cursor-pointer rounded-full px-1.5 text-[10px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 ${
          auto ? 'bg-ink/[0.12] text-ink' : 'text-ink-35 hover:text-ink-70'
        }`}
      >
        {t('player.pitchModeAutoShort')}
      </button>
    </PaceSlider>
  );
}
