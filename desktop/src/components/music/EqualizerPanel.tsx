import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {EQ_BAND_COUNT, EQ_LABELS, EQ_MAX_GAIN, EQ_MIN_GAIN} from '../../lib/equalizer';
import {AudioLines, Power, RotateCcw, X} from '../../lib/icons';
import {useSettingsStore} from '../../stores/settings';
import {Modal, ModalClose, ModalContent, ModalTrigger} from '../ui/Modal';
import {EqPreamp} from './EqPreamp';
import {EqPresets} from './EqPresets';
import {EqSlider} from './EqSlider';
import {TrackSoundToggle} from './TrackSoundToggle';

/* ── Main Panel ─────────────────────────────────────────────── */

export const EqualizerPanel = React.memo(function EqualizerPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const eqEnabled = useSettingsStore((s) => s.eqEnabled);
  const eqGains = useSettingsStore((s) => s.eqGains);
  const setEqEnabled = useSettingsStore((s) => s.setEqEnabled);
  const setEqGains = useSettingsStore((s) => s.setEqGains);
  const setEqPreset = useSettingsStore((s) => s.setEqPreset);
  const setEqBand = useSettingsStore((s) => s.setEqBand);
  const setEqPreamp = useSettingsStore((s) => s.setEqPreamp);

  const handleBandChange = useCallback(
    (index: number, gain: number) => {
      setEqBand(index, gain);
    },
    [setEqBand],
  );

  const handleReset = useCallback(() => {
    setEqGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    setEqPreamp(null);
    setEqPreset('flat');
  }, [setEqGains, setEqPreamp, setEqPreset]);

  return (
      <Modal>
          <ModalTrigger asChild>{children}</ModalTrigger>
          <ModalContent size="md" showClose={false} zClass="z-[90]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                  <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-ink/[0.06] flex items-center justify-center">
                          <AudioLines size={18} className="text-ink-60"/>
                      </div>
                      <h2 className="text-[17px] font-bold text-ink-90 tracking-tight">{t('eq.title')}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                      {/* Power toggle */}
                      <button
                          type="button"
                          onClick={() => setEqEnabled(!eqEnabled)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer border ${
                              eqEnabled
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.15)]'
                                  : 'bg-ink/[0.04] text-ink-25 border-ink/[0.06] hover:text-ink-50'
                          }`}
                      >
                          <Power size={15}/>
                      </button>
                      {/* Reset */}
                      <button
                          type="button"
                          onClick={handleReset}
                          className="w-9 h-9 rounded-xl bg-ink/[0.04] border border-ink/[0.06] flex items-center justify-center text-ink-25 hover:text-ink-50 transition-all cursor-pointer"
                      >
                          <RotateCcw size={14}/>
                      </button>
                      {/* Close */}
                      <ModalClose
                          className="w-9 h-9 rounded-xl bg-ink/[0.04] border border-ink/[0.06] flex items-center justify-center text-ink-25 hover:text-ink-50 transition-all cursor-pointer">
                          <X size={15}/>
                      </ModalClose>
                  </div>
              </div>

              {/* dB scale + Sliders */}
              <div
                  className={`px-6 pb-4 transition-opacity duration-300 ${eqEnabled ? '' : 'opacity-30 pointer-events-none'}`}
              >
                  <div className="flex items-end gap-0">
                      <EqPreamp/>
                      <div className="mx-2.5 mb-[21px] h-[140px] w-px self-end bg-ink/[0.06]"/>
                      {/* dB labels */}
                      <div className="flex flex-col justify-between h-[140px] mr-2 -mt-6">
                          <span className="text-[9px] text-ink-20 tabular-nums">+12</span>
                          <span className="text-[9px] text-ink-20 tabular-nums">0</span>
                          <span className="text-[9px] text-ink-20 tabular-nums">-12</span>
                      </div>
                      {/* Band sliders */}
                      <div className="flex-1 flex justify-between">
                          {Array.from({length: EQ_BAND_COUNT}, (_, i) => (
                              <EqSlider
                                  key={i}
                                  index={i}
                                  value={eqGains[i] ?? 0}
                                  min={EQ_MIN_GAIN}
                                  max={EQ_MAX_GAIN}
                                  label={EQ_LABELS[i]}
                                  onChange={handleBandChange}
                              />
                          ))}
                      </div>
                  </div>
              </div>

              {/* Presets */}
              <div
                  className={`px-6 pb-5 transition-opacity duration-300 ${eqEnabled ? '' : 'opacity-30 pointer-events-none'}`}
              >
                  <EqPresets/>
              </div>
              <div className="px-6 pb-6">
                  <TrackSoundToggle/>
              </div>
          </ModalContent>
      </Modal>
  );
});
