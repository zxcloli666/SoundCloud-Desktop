import React from 'react';
import { useTranslation } from 'react-i18next';
import { AURAS, type Aura } from '../../lib/aura';
import {Sparkles} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';

interface AuraPickerProps {
  aura: Aura;
  onPickAura: (a: Aura) => void;
  customHex: string;
  onPickCustom: (hex: string) => void;
}

function AuraPickerImpl({ aura, onPickAura, customHex, onPickCustom }: AuraPickerProps) {
  const { t } = useTranslation();
    const b = usePerfMode().blur(20);
  return (
    <div
      className="flex items-center gap-2 p-1.5 rounded-2xl"
      style={{
          background: b > 0 ? 'rgb(var(--ink) / 0.04)' : 'rgb(var(--surface-hi) / 0.85)',
        border: '0.5px solid rgb(var(--ink) / 0.08)',
          backdropFilter: b > 0 ? `blur(${b}px)` : undefined,
          WebkitBackdropFilter: b > 0 ? `blur(${b}px)` : undefined,
      }}
    >
      <span className="px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-30 flex items-center gap-1.5">
        <Sparkles size={11} /> {t('user.auraTitle')}
      </span>
      {AURAS.map((a) => {
        const active = a.id === aura.id;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onPickAura(a)}
            title={a.name}
            className="relative w-7 h-7 rounded-lg cursor-pointer transition-transform duration-300 hover:scale-110"
            style={{
              background: `conic-gradient(from 0deg, ${a.orbs[0]}, ${a.orbs[1]}, ${a.orbs[2]}, ${a.orbs[0]})`,
              boxShadow: active
                ? `0 0 0 2px rgb(var(--ink) / 0.9), 0 0 14px ${a.orbs[0]}88`
                : 'inset 0 0 0 0.5px rgb(var(--ink) / 0.15)',
            }}
          />
        );
      })}
      <label
        className="relative w-7 h-7 rounded-lg cursor-pointer transition-transform duration-300 hover:scale-110 overflow-hidden"
        title={t('user.auraCustom')}
        style={{
          background:
            'conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #06b6d4, #6366f1, #ec4899, #ef4444)',
          boxShadow:
            aura.id === 'custom'
              ? `0 0 0 2px rgb(var(--ink) / 0.9), 0 0 14px ${customHex}88`
              : 'inset 0 0 0 0.5px rgb(var(--ink) / 0.15)',
        }}
      >
        <input
          type="color"
          value={customHex}
          onChange={(e) => onPickCustom(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-ink drop-shadow-[0_0_4px_rgba(0,0,0,0.6)]">
          <Sparkles size={12} />
        </span>
      </label>
    </div>
  );
}

export const AuraPicker = React.memo(AuraPickerImpl);
