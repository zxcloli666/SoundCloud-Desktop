import * as Dialog from '@radix-ui/react-dialog';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EQ_BAND_COUNT,
  EQ_LABELS,
  EQ_MAX_GAIN,
  EQ_MIN_GAIN,
  EQ_PRESETS,
} from '../../lib/equalizer';
import { AudioLines, Power, RotateCcw, X } from '../../lib/icons';
import { useSettingsStore } from '../../stores/settings';

/* ── Single Band Slider ─────────────────────────────────────── */

const BandSlider = React.memo(function BandSlider({
  index,
  gain,
  label,
  onChange,
}: {
  index: number;
  gain: number;
  label: string;
  onChange: (index: number, gain: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const calcGain = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const pct = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return Math.round((pct * (EQ_MAX_GAIN - EQ_MIN_GAIN) + EQ_MIN_GAIN) * 2) / 2;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onChange(index, calcGain(e.clientY));
    },
    [index, onChange, calcGain],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      onChange(index, calcGain(e.clientY));
    },
    [index, onChange, calcGain],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Normalized 0-1 position
  const pct = (gain - EQ_MIN_GAIN) / (EQ_MAX_GAIN - EQ_MIN_GAIN);
  const isPositive = gain > 0;
  const isNegative = gain < 0;

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      {/* Gain value */}
      <span
        className={`text-[10px] tabular-nums font-semibold h-4 ${
          isPositive ? 'text-emerald-400' : isNegative ? 'text-blue-400' : 'text-white/30'
        }`}
      >
        {gain > 0 ? '+' : ''}
        {gain.toFixed(1)}
      </span>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative w-7 h-[140px] flex items-center justify-center cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Rail */}
        <div className="absolute w-[3px] h-full rounded-full bg-white/[0.06]" />

        {/* Center line */}
        <div className="absolute w-2 h-px bg-white/10 left-1/2 top-1/2 -translate-x-1/2" />

        {/* Fill */}
        <div
          className="absolute w-[3px] rounded-full left-1/2 -translate-x-1/2 transition-colors duration-150"
          style={{
            bottom: gain >= 0 ? '50%' : `${pct * 100}%`,
            top: gain >= 0 ? `${(1 - pct) * 100}%` : '50%',
            background: isPositive
              ? 'linear-gradient(to top, rgba(52,211,153,0.6), rgba(52,211,153,0.2))'
              : isNegative
                ? 'linear-gradient(to bottom, rgba(96,165,250,0.6), rgba(96,165,250,0.2))'
                : 'transparent',
          }}
        />

        {/* Thumb */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full transition-shadow duration-150 will-change-transform"
          style={{
            bottom: `calc(${pct * 100}% - 8px)`,
            background: isPositive
              ? 'rgb(52,211,153)'
              : isNegative
                ? 'rgb(96,165,250)'
                : 'rgba(255,255,255,0.5)',
            boxShadow:
              gain !== 0
                ? isPositive
                  ? '0 0 12px rgba(52,211,153,0.4)'
                  : '0 0 12px rgba(96,165,250,0.4)'
                : 'none',
          }}
        />
      </div>

      {/* Frequency label */}
      <span className="text-[9px] text-white/30 font-medium">{label}</span>
    </div>
  );
});

/* ── Preset Button ──────────────────────────────────────────── */

const PresetBtn = React.memo(function PresetBtn({
  id,
  label,
  active,
  onClick,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 cursor-pointer border ${
        active
          ? 'bg-white/[0.1] text-white/90 border-white/[0.12] shadow-sm'
          : 'bg-white/[0.02] text-white/35 border-white/[0.04] hover:bg-white/[0.06] hover:text-white/60'
      }`}
    >
      {label}
    </button>
  );
});

/* ── Main Panel ─────────────────────────────────────────────── */

export const EqualizerPanel = React.memo(function EqualizerPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const eqEnabled = useSettingsStore((s) => s.eqEnabled);
  const eqGains = useSettingsStore((s) => s.eqGains);
  const eqPreset = useSettingsStore((s) => s.eqPreset);
  const setEqEnabled = useSettingsStore((s) => s.setEqEnabled);
  const setEqGains = useSettingsStore((s) => s.setEqGains);
  const setEqPreset = useSettingsStore((s) => s.setEqPreset);
  const setEqBand = useSettingsStore((s) => s.setEqBand);

  const isRu = i18n.language === 'ru';

  const handleBandChange = useCallback(
    (index: number, gain: number) => {
      setEqBand(index, gain);
    },
    [setEqBand],
  );

  const handlePreset = useCallback(
    (id: string) => {
      const preset = EQ_PRESETS[id];
      if (preset) {
        setEqGains([...preset.gains]);
        setEqPreset(id);
      }
    },
    [setEqGains, setEqPreset],
  );

  const handleReset = useCallback(() => {
    setEqGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    setEqPreset('flat');
  }, [setEqGains, setEqPreset]);

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-[95vw] animate-fade-in-up outline-none">
          <div className="liquid-panel overflow-hidden rounded-[32px]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center">
                  <AudioLines size={18} className="text-white/60" />
                </div>
                <h2 className="text-[17px] font-bold text-white/90 tracking-tight">
                  {t('eq.title')}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Power toggle */}
                <button
                  type="button"
                  onClick={() => setEqEnabled(!eqEnabled)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer border ${
                    eqEnabled
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.15)]'
                      : 'bg-white/[0.04] text-white/25 border-white/[0.06] hover:text-white/50'
                  }`}
                >
                  <Power size={15} />
                </button>
                {/* Reset */}
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/25 hover:text-white/50 transition-all cursor-pointer"
                >
                  <RotateCcw size={14} />
                </button>
                {/* Close */}
                <Dialog.Close className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/25 hover:text-white/50 transition-all cursor-pointer">
                  <X size={15} />
                </Dialog.Close>
              </div>
            </div>

            {/* dB scale + Sliders */}
            <div
              className={`px-6 pb-4 transition-opacity duration-300 ${eqEnabled ? '' : 'opacity-30 pointer-events-none'}`}
            >
              <div className="flex items-end gap-0">
                {/* dB labels */}
                <div className="flex flex-col justify-between h-[140px] mr-2 -mt-6">
                  <span className="text-[9px] text-white/20 tabular-nums">+12</span>
                  <span className="text-[9px] text-white/20 tabular-nums">0</span>
                  <span className="text-[9px] text-white/20 tabular-nums">-12</span>
                </div>
                {/* Band sliders */}
                <div className="flex-1 flex justify-between">
                  {Array.from({ length: EQ_BAND_COUNT }, (_, i) => (
                    <BandSlider
                      key={i}
                      index={i}
                      gain={eqGains[i] ?? 0}
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
              <p className="text-[11px] text-white/30 font-medium mb-2.5">{t('eq.preset')}</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(EQ_PRESETS).map(([id, preset]) => (
                  <PresetBtn
                    key={id}
                    id={id}
                    label={isRu ? preset.labelRu : preset.label}
                    active={eqPreset === id}
                    onClick={handlePreset}
                  />
                ))}
                {eqPreset === 'custom' && (
                  <PresetBtn id="custom" label={t('eq.custom')} active onClick={() => {}} />
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
