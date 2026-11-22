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
      data-on={value || undefined}
      className="chip-toggle"
    >
      <Heart size={12} fill={value ? 'currentColor' : 'none'} />
      <span>{t('soundwave.hideLikedLabel')}</span>
      <span className="chip-toggle-switch" />
    </button>
  );
});
