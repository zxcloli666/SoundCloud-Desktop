import React from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from '../../../lib/icons';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
}

export const HideLikedToggle = React.memo(function HideLikedToggle({ value, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      title={t(value ? 'soundwave.hideLikedOn' : 'soundwave.hideLikedOff')}
      className="flex items-center gap-1.5 px-3 h-8 rounded-full border transition-colors duration-200 text-[11px] font-medium cursor-pointer"
      style={{
        background: value ? 'var(--color-accent-glow)' : 'rgb(var(--ink) / 0.06)',
        borderColor: value ? 'var(--color-accent-glow)' : 'rgb(var(--ink) / 0.08)',
        color: value ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.7)',
      }}
    >
      <Heart size={12} fill={value ? 'currentColor' : 'none'} />
      <span>{t('soundwave.hideLikedLabel')}</span>
      <span
        className="ml-1 w-[22px] h-[12px] rounded-full relative transition-colors"
        style={{
          background: value ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.18)',
        }}
      >
        <span
          className="absolute top-[1px] w-[10px] h-[10px] rounded-full bg-white transition-all"
          style={{ left: value ? '10px' : '1px' }}
        />
      </span>
    </button>
  );
});
