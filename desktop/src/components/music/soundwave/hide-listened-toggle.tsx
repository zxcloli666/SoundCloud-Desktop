import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from '../../../lib/icons';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
}

export const HideListenedToggle = React.memo(function HideListenedToggle({
  value,
  onChange,
}: Props) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      title={t(value ? 'soundwave.hideListenedOn' : 'soundwave.hideListenedOff')}
      data-on={value || undefined}
      className="chip-toggle"
    >
      <Clock size={12} />
      <span>{t('soundwave.hideListenedLabel')}</span>
      <span className="chip-toggle-switch" />
    </button>
  );
});
